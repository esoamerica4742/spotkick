import { DurableObject } from "cloudflare:workers";
import { CHOICE_WINDOW_MS, CPU_ID, KEEPER_REACT_MS, KEEPER_SYNC_SLACK_MS, PLAYBACK_MS, REGULATION_KICKS } from "../src/lib/constants";
import { persistRound as persistRoundRow, settleMatchKobo, type SettleReason } from "../src/lib/cf/ledger";
import {
  clampAccuracy,
  clampMilliX,
  clampMilliY,
  isRoboticFractionalTs,
  isRoboticTiming,
  matchWinner,
  milliFromZone,
  rakeAndPayout,
  randomCpuAccuracy,
  cpuReadCover,
  cpuStrikePlan,
  resolveAim,
  runupForViewer,
  shooterForKick,
  zoneFromMilliX,
  fractionalMs,
  type AimPoint,
} from "../src/lib/game/engine";
import { CHAT_GAP_MS, CHAT_KEEP, cleanMatchChat } from "../src/lib/game/chat";
import { buildTurn } from "../src/lib/game/turn";
import type {
  EscrowLedger,
  Match,
  MatchChatMessage,
  MatchView,
  Round,
} from "../src/lib/game/types";
import type { Zone } from "../src/lib/constants";
import { coerceTeamId, type TeamId } from "../src/lib/teams";

export type MatchInit = {
  match: Match;
  playerA: MatchView["playerA"];
  playerB: MatchView["playerB"];
};

type Stored = {
  match: Match;
  rounds: Round[];
  playerA: MatchView["playerA"];
  playerB: MatchView["playerB"];
  escrow: EscrowLedger | null;
  alarmKind: "expire" | "open" | null;
  timeoutStreak: Record<string, number>;
  timingOffsetsMs: Record<string, number[]>;
  timingFracs: Record<string, number[]>;
  chat: MatchChatMessage[];
  lastChatAt: Record<string, number>;
};

function asTeam(value: string | null | undefined): TeamId {
  return coerceTeamId(value);
}

function openRound(match: Match, delayMs: number): Round {
  const { shooterId, keeperId } = shooterForKick(
    match.current_round,
    match.player_a_id,
    match.player_b_id!,
  );
  const opens = Date.now() + delayMs;
  return {
    id: crypto.randomUUID(),
    match_id: match.id,
    round_number: match.current_round,
    shooter_id: shooterId,
    keeper_id: keeperId,
    shooter_choice: null,
    keeper_choice: null,
    shooter_accuracy: null,
    keeper_accuracy: null,
    shooter_x: null,
    shooter_y: null,
    keeper_x: null,
    keeper_y: null,
    outcome: "pending",
    choice_opens_at: new Date(opens).toISOString(),
    choice_closes_at: new Date(opens + CHOICE_WINDOW_MS).toISOString(),
    resolved_at: null,
  };
}

function maskRound(round: Round, userId: string): Round {
  if (round.outcome !== "pending") return round;
  return {
    ...round,
    shooter_choice: round.shooter_id === userId ? round.shooter_choice : null,
    keeper_choice: round.keeper_id === userId ? round.keeper_choice : null,
    shooter_accuracy:
      round.shooter_id === userId ? round.shooter_accuracy : null,
    keeper_accuracy: round.keeper_id === userId ? round.keeper_accuracy : null,
    shooter_x: round.shooter_id === userId ? round.shooter_x : null,
    shooter_y: round.shooter_id === userId ? round.shooter_y : null,
    keeper_x: round.keeper_id === userId ? round.keeper_x : null,
    keeper_y: round.keeper_id === userId ? round.keeper_y : null,
  };
}

export class MatchDurableObject extends DurableObject<CloudflareEnv> {
  private cached: Stored | null = null;

  private async load(): Promise<Stored | null> {
    if (this.cached) return this.cached;
    const stored = await this.ctx.storage.get<Stored>("state");
    if (!stored) {
      this.cached = null;
      return null;
    }
    stored.timeoutStreak ??= {};
    stored.timingOffsetsMs ??= {};
    stored.timingFracs ??= {};
    stored.chat ??= [];
    stored.lastChatAt ??= {};
    this.cached = stored;
    return this.cached;
  }

  private async save(state: Stored) {
    this.cached = state;
    await this.ctx.storage.put("state", state);
  }

  private view(state: Stored, userId: string, except?: WebSocket): MatchView {
    const live = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    const rounds = state.rounds.map((round) => maskRound(round, userId));
    const current =
      rounds.find((round) => round.round_number === state.match.current_round) ??
      null;
    const turn = buildTurn(state.match, current, userId);
    const runup = runupForViewer(live, userId);
    return {
      match: state.match,
      rounds,
      playerA: state.playerA,
      playerB: state.playerB,
      escrow: state.escrow,
      myRole: current
        ? current.shooter_id === userId
          ? "shooter"
          : "keeper"
        : null,
      currentRound: current,
      isStriker: turn.isStriker,
      kickerLocked: Boolean(live && live.shooter_x != null),
      runupX: runup?.x ?? null,
      runupY: runup?.y ?? null,
      chat: this.humanDuel(state) ? state.chat : [],
      oppHere: this.oppHere(state, userId, except),
      humanDuel: this.humanDuel(state),
      turn,
    };
  }

  private broadcast(state: Stored, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (except && ws === except) continue;
      const userId = ws.deserializeAttachment() as string | null;
      if (!userId) continue;
      try {
        const view = this.view(state, userId, except);
        ws.send(
          JSON.stringify({
            type: "state",
            view,
            isStriker: view.isStriker,
            score: view.turn.score,
          }),
        );
      } catch {
        // Client already gone.
      }
    }
  }

  private async schedule(state: Stored) {
    const round = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    if (!round || round.outcome !== "pending" || state.match.status !== "active") {
      await this.ctx.storage.deleteAlarm();
      state.alarmKind = null;
      await this.save(state);
      return;
    }
    const now = Date.now();
    const opens = new Date(round.choice_opens_at).getTime();
    const closes = new Date(round.choice_closes_at).getTime();
    let at = closes;
    let kind: Stored["alarmKind"] = "expire";
    if (now < opens) {
      at = opens;
      kind = "open";
    }
    state.alarmKind = kind;
    await this.save(state);
    await this.ctx.storage.setAlarm(at);
  }

  async start(init: MatchInit) {
    const existing = await this.load();
    if (existing && existing.match.status !== "waiting") return existing.match;
    const match = {
      ...init.match,
      player_a_team: asTeam(init.match.player_a_team),
      player_b_team: init.match.player_b_team
        ? asTeam(init.match.player_b_team)
        : null,
      status: "active" as const,
      started_at: init.match.started_at ?? new Date().toISOString(),
    };
    const { totalPool, platformRake, payoutAmount } =
      init.playerB?.id === CPU_ID
        ? { totalPool: 0, platformRake: 0, payoutAmount: 0 }
        : rakeAndPayout(match.stake_amount, 2);
    const escrow: EscrowLedger = {
      id: crypto.randomUUID(),
      match_id: match.id,
      total_pool: totalPool,
      platform_rake: platformRake,
      payout_amount: payoutAmount,
      status: "held",
      created_at: new Date().toISOString(),
      released_at: null,
    };
    const first = openRound(match, 0);
    const state: Stored = {
      match,
      rounds: [first],
      playerA: init.playerA,
      playerB: init.playerB,
      escrow,
      alarmKind: null,
      timeoutStreak: {},
      timingOffsetsMs: {},
      timingFracs: {},
      chat: [],
      lastChatAt: {},
    };
    this.armCpuShooter(state, first);
    await this.save(state);
    await this.persistRound(first);
    await this.schedule(state);
    this.broadcast(state);
    return match;
  }

  async getView(userId: string): Promise<MatchView | null> {
    const state = await this.load();
    if (!state) return null;
    return this.view(state, userId);
  }

  async forfeit(userId: string): Promise<MatchView> {
    const state = await this.load();
    if (!state) throw new Error("Match not found");
    if (
      state.match.player_a_id !== userId &&
      state.match.player_b_id !== userId
    ) {
      throw new Error("Not a participant");
    }
    if (
      state.match.status === "completed" ||
      state.match.status === "cancelled"
    ) {
      return this.view(state, userId);
    }

    if (state.match.status === "waiting" || !state.match.player_b_id) {
      const now = new Date().toISOString();
      state.match.status = "cancelled";
      state.match.completed_at = now;
      await this.save(state);
      await this.env.DB.batch([
        this.env.DB.prepare(
          `UPDATE matches SET status = 'cancelled', completed_at = datetime('now')
           WHERE id = ? AND status = 'waiting' AND player_a_id = ? AND player_b_id IS NULL`,
        ).bind(state.match.id, userId),
        this.env.DB.prepare(
          `UPDATE wallets
           SET balance = balance + ?,
               ledger_balance = MAX(0, ledger_balance - ?),
               updated_at = datetime('now')
           WHERE user_id = ?`,
        ).bind(state.match.stake_amount, state.match.stake_amount, userId),
      ]);
      this.broadcast(state);
      await this.ctx.storage.deleteAlarm();
      return this.view(state, userId);
    }

    if (state.match.status !== "active") {
      return this.view(state, userId);
    }

    const winnerId =
      userId === state.match.player_a_id
        ? state.match.player_b_id
        : state.match.player_a_id;
    if (!winnerId) throw new Error("No opponent");
    const now = new Date().toISOString();
    state.match.status = "completed";
    state.match.winner_id = winnerId;
    state.match.completed_at = now;
    if (state.escrow) {
      state.escrow.status = "released";
      state.escrow.released_at = now;
    }
    await this.save(state);
    await this.releaseEscrow(state, winnerId, "forfeit");
    this.broadcast(state);
    await this.ctx.storage.deleteAlarm();
    return this.view(state, userId);
  }

  async submitAction(input: {
    userId: string;
    role: "kicker" | "keeper";
    direction?: Zone;
    x?: number;
    y?: number;
    accuracyScore: number;
    clientTs?: number;
  }): Promise<MatchView> {
    const state = await this.load();
    if (!state) throw new Error("Match not found");
    const round = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    if (!round || round.outcome !== "pending") {
      throw new Error("Round already resolved");
    }
    const expected: "kicker" | "keeper" =
      input.userId === round.shooter_id ? "kicker" : "keeper";
    if (input.userId !== round.shooter_id && input.userId !== round.keeper_id) {
      throw new Error("Not in this round");
    }
    if (input.role !== expected) {
      throw new Error(`Role must be ${expected} this turn`);
    }
    const aim =
      typeof input.x === "number" && typeof input.y === "number"
        ? { x: input.x, y: input.y }
        : input.direction
          ? milliFromZone(input.direction)
          : null;
    if (!aim) throw new Error("Aim point required");
    await this.submitAim(
      input.userId,
      aim,
      input.accuracyScore,
      input.clientTs,
    );
    const next = await this.load();
    if (!next) throw new Error("Match not found");
    return this.view(next, input.userId);
  }

  async submitChoice(
    userId: string,
    zone: Zone,
    accuracyScore?: number,
    clientTs?: number,
  ) {
    await this.submitAim(userId, milliFromZone(zone), accuracyScore, clientTs);
  }

  async submitAim(
    userId: string,
    aim: AimPoint,
    accuracyScore?: number,
    clientTs?: number,
    timeElapsed?: number,
    executionScore?: number,
  ) {
    const state = await this.load();
    if (!state) throw new Error("Match not found");
    this.applyAim(
      state,
      userId,
      aim,
      accuracyScore,
      clientTs,
      timeElapsed,
      executionScore,
    );
    state.timeoutStreak[userId] = 0;
    const round = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    if (round && userId === round.shooter_id && round.shooter_x != null) {
      this.openKeeperWindow(round);
    }
    await this.save(state);
    if (round && round.shooter_x != null && round.keeper_x != null) {
      await this.finishRound(state, round);
    } else {
      await this.persistRound(round!);
      this.broadcast(state);
      await this.schedule(state);
    }
  }

  async alarm() {
    const state = await this.load();
    if (!state) return;
    const round = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    if (!round || round.outcome !== "pending") return;
    const kind = state.alarmKind;
    if (kind === "open") {
      this.armCpuShooter(state, round);
      await this.save(state);
      await this.schedule(state);
      this.broadcast(state);
      return;
    }
    if (Date.now() < new Date(round.choice_closes_at).getTime()) {
      await this.schedule(state);
      return;
    }
    await this.finishRound(state, round);
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const userId = request.headers.get("X-Spotkick-User");
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const stateForAuth = await this.load();
    if (
      stateForAuth &&
      stateForAuth.match.player_a_id !== userId &&
      stateForAuth.match.player_b_id !== userId
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(userId);
    const state = await this.load();
    if (state) {
      const view = this.view(state, userId);
      server.send(
        JSON.stringify({
          type: "state",
          view,
          isStriker: view.isStriker,
          score: view.turn.score,
        }),
      );
      void this.noteBothHere(state).then(() => this.broadcast(state));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const userId = ws.deserializeAttachment() as string | null;
    if (!userId) return;
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    let payload: {
      type?: string;
      zone?: Zone;
      x?: number;
      y?: number;
      accuracyScore?: number;
      accuracy?: number;
      clientTs?: number;
      timeElapsed?: number;
      executionScore?: number;
      text?: string;
    };
    try {
      payload = JSON.parse(text) as {
        type?: string;
        zone?: Zone;
        x?: number;
        y?: number;
        accuracyScore?: number;
        accuracy?: number;
        clientTs?: number;
        timeElapsed?: number;
        executionScore?: number;
        text?: string;
      };
    } catch {
      return;
    }
    if (payload.type === "chat") {
      try {
        await this.postChat(userId, payload.text);
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "chat_error",
            error: error instanceof Error ? error.message : "That line did not go through",
          }),
        );
      }
      return;
    }
    if (payload.type === "typing") {
      void this.relayTyping(userId);
      return;
    }
    if (payload.type === "forfeit") {
      try {
        await this.forfeit(userId);
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Forfeit failed",
          }),
        );
      }
      return;
    }
    if (
      (payload.type === "choice" || payload.type === "aim") &&
      (payload.zone ||
        (typeof payload.x === "number" && typeof payload.y === "number"))
    ) {
      try {
        const aim =
          typeof payload.x === "number" && typeof payload.y === "number"
            ? { x: payload.x, y: payload.y }
            : milliFromZone(payload.zone!);
        await this.submitAim(
          userId,
          aim,
          payload.executionScore ?? payload.accuracyScore ?? payload.accuracy,
          payload.clientTs,
          payload.timeElapsed,
          payload.executionScore,
        );
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Choice failed",
          }),
        );
      }
    }
    if (payload.type === "sync") {
      const state = await this.load();
      if (state) {
        const view = this.view(state, userId);
        ws.send(
          JSON.stringify({
            type: "state",
            view,
            isStriker: view.isStriker,
            score: view.turn.score,
          }),
        );
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    const state = await this.load();
    if (state) this.broadcast(state, ws);
    try {
      ws.close();
    } catch {
      // Already closing.
    }
  }

  private humanDuel(state: Stored): boolean {
    return Boolean(
      state.match.player_b_id && state.match.player_b_id !== CPU_ID,
    );
  }

  private connectedIds(except?: WebSocket): Set<string> {
    const ids = new Set<string>();
    for (const socket of this.ctx.getWebSockets()) {
      if (except && socket === except) continue;
      const id = socket.deserializeAttachment() as string | null;
      if (id) ids.add(id);
    }
    return ids;
  }

  private oppHere(state: Stored, userId: string, except?: WebSocket): boolean {
    const opp =
      userId === state.match.player_a_id
        ? state.match.player_b_id
        : userId === state.match.player_b_id
          ? state.match.player_a_id
          : null;
    if (!opp || opp === CPU_ID) return false;
    return this.connectedIds(except).has(opp);
  }

  private async noteBothHere(state: Stored) {
    if (!this.humanDuel(state)) return;
    const a = state.match.player_a_id;
    const b = state.match.player_b_id;
    if (!b) return;
    const ids = this.connectedIds();
    if (!ids.has(a) || !ids.has(b)) return;
    if (state.chat.some((item) => item.fromId === null)) return;
    state.chat.push({
      id: crypto.randomUUID(),
      fromId: null,
      text: "Two humans on this pitch. Stake locked.",
      at: new Date().toISOString(),
    });
    await this.save(state);
  }

  private async relayTyping(userId: string) {
    const state = await this.load();
    if (!state || !this.humanDuel(state) || state.match.status !== "active") {
      return;
    }
    for (const socket of this.ctx.getWebSockets()) {
      const peer = socket.deserializeAttachment() as string | null;
      if (!peer || peer === userId) continue;
      try {
        socket.send(JSON.stringify({ type: "typing", fromId: userId }));
      } catch {
        // Peer gone.
      }
    }
  }

  private async postChat(userId: string, raw: unknown) {
    const state = await this.load();
    if (!state) throw new Error("Match not found");
    if (!this.humanDuel(state)) throw new Error("No rival on this pitch");
    if (
      userId !== state.match.player_a_id &&
      userId !== state.match.player_b_id
    ) {
      throw new Error("Not in this match");
    }
    if (state.match.status !== "active") {
      throw new Error("Match is over");
    }
    const text = cleanMatchChat(raw);
    if (!text) throw new Error("That line cannot go through");
    const now = Date.now();
    const last = state.lastChatAt[userId] ?? 0;
    if (now - last < CHAT_GAP_MS) throw new Error("Wait a beat");
    state.lastChatAt[userId] = now;
    state.chat.push({
      id: crypto.randomUUID(),
      fromId: userId,
      text,
      at: new Date().toISOString(),
    });
    if (state.chat.length > CHAT_KEEP) {
      state.chat = state.chat.slice(-CHAT_KEEP);
    }
    await this.save(state);
    this.broadcast(state);
  }

  private applyAim(
    state: Stored,
    userId: string,
    aim: AimPoint,
    accuracyScore?: number,
    clientTs?: number,
    timeElapsed?: number,
    executionScore?: number,
  ) {
    if (state.match.status !== "active") throw new Error("Match is not active");
    const round = state.rounds.find(
      (item) => item.round_number === state.match.current_round,
    );
    if (!round || round.outcome !== "pending") {
      throw new Error("Round already resolved");
    }
    if (Date.now() < new Date(round.choice_opens_at).getTime()) {
      throw new Error("Choice window has not opened");
    }
    if (userId !== CPU_ID) {
      const opens = new Date(round.choice_opens_at).getTime();
      const offsetMs = Date.now() - opens;
      const offsets = state.timingOffsetsMs[userId] ?? [];
      const nextOffsets = [...offsets, offsetMs];
      if (isRoboticTiming(nextOffsets)) {
        throw new Error("Robotic timing signature");
      }
      if (
        typeof clientTs === "number" &&
        Number.isFinite(clientTs) &&
        !Number.isInteger(clientTs)
      ) {
        const fracs = state.timingFracs[userId] ?? [];
        const nextFracs = [...fracs, fractionalMs(clientTs)];
        if (isRoboticFractionalTs(nextFracs)) {
          throw new Error("Robotic timing signature");
        }
        state.timingFracs[userId] = nextFracs.slice(-8);
      }
      state.timingOffsetsMs[userId] = nextOffsets.slice(-8);
    }
    const freezeScore =
      typeof executionScore === "number" && Number.isFinite(executionScore)
        ? executionScore
        : accuracyScore;
    const accuracy = clampAccuracy(freezeScore, 100);
    const point = { x: clampMilliX(aim.x), y: clampMilliY(aim.y) };
    const zone = zoneFromMilliX(point.x);
    if (userId === round.shooter_id) {
      if (round.shooter_x != null) throw new Error("Choice already locked");
      round.shooter_x = point.x;
      round.shooter_y = point.y;
      round.shooter_choice = zone;
      round.shooter_accuracy = accuracy;
      return;
    }
    if (userId === round.keeper_id) {
      if (round.shooter_x == null) throw new Error("Wait for the strike");
      if (round.keeper_x != null) throw new Error("Choice already locked");
      const openedAt =
        new Date(round.choice_closes_at).getTime() - KEEPER_REACT_MS;
      const serverElapsed = Date.now() - openedAt;
      const clientElapsed =
        typeof timeElapsed === "number" && Number.isFinite(timeElapsed)
          ? timeElapsed
          : serverElapsed;
      const late =
        serverElapsed > KEEPER_REACT_MS + KEEPER_SYNC_SLACK_MS ||
        clientElapsed > KEEPER_REACT_MS;
      round.keeper_x = point.x;
      round.keeper_y = point.y;
      round.keeper_choice = zone;
      round.keeper_accuracy = late ? 0 : accuracy;
      return;
    }
    throw new Error("Not in this round");
  }

  private openKeeperWindow(round: Round) {
    round.choice_closes_at = new Date(Date.now() + KEEPER_REACT_MS).toISOString();
  }

  private armCpuShooter(state: Stored, round: Round) {
    if (state.match.player_b_id !== CPU_ID) return;
    if (round.shooter_id !== CPU_ID || round.shooter_x != null) return;
    if (Date.now() < new Date(round.choice_opens_at).getTime()) return;
    const plan = cpuStrikePlan();
    this.applyAim(state, CPU_ID, plan.aim, plan.accuracy);
    this.openKeeperWindow(round);
  }

  private applyCpuIfNeeded(state: Stored, round: Round) {
    if (state.match.player_b_id !== CPU_ID) return;
    if (round.shooter_id === CPU_ID && round.shooter_x == null) {
      const plan = cpuStrikePlan();
      round.shooter_x = plan.aim.x;
      round.shooter_y = plan.aim.y;
      round.shooter_choice = zoneFromMilliX(plan.aim.x);
      round.shooter_accuracy = plan.accuracy;
    }
    if (
      round.keeper_id === CPU_ID &&
      round.keeper_x == null &&
      round.shooter_x != null
    ) {
      const acc = randomCpuAccuracy();
      const cover = cpuReadCover(
        { x: round.shooter_x, y: round.shooter_y ?? 500 },
        acc,
        round.shooter_accuracy ?? 100,
      );
      round.keeper_x = cover.x;
      round.keeper_y = cover.y;
      round.keeper_choice = zoneFromMilliX(cover.x);
      round.keeper_accuracy = acc;
    }
  }

  private timedOutWinner(state: Stored, round: Round): string | null {
    const missed: string[] = [];
    if (round.shooter_x == null && round.shooter_id !== CPU_ID) {
      round.shooter_accuracy = 0;
      missed.push(round.shooter_id);
    }
    if (
      round.shooter_x != null &&
      round.keeper_x == null &&
      round.keeper_id !== CPU_ID
    ) {
      round.keeper_accuracy = 0;
      missed.push(round.keeper_id);
    }
    let forfeiter: string | null = null;
    for (const uid of missed) {
      state.timeoutStreak[uid] = (state.timeoutStreak[uid] ?? 0) + 1;
      if ((state.timeoutStreak[uid] ?? 0) >= 2) forfeiter = uid;
    }
    if (!forfeiter) return null;
    const winnerId =
      forfeiter === state.match.player_a_id
        ? state.match.player_b_id
        : state.match.player_a_id;
    if (!winnerId) throw new Error("No opponent");
    return winnerId;
  }

  private async finishRound(state: Stored, round: Round) {
    this.applyCpuIfNeeded(state, round);
    const timeoutWinner = this.timedOutWinner(state, round);
    const shot =
      round.shooter_x != null && round.shooter_y != null
        ? { x: round.shooter_x, y: round.shooter_y }
        : null;
    const cover =
      round.keeper_x != null && round.keeper_y != null
        ? { x: round.keeper_x, y: round.keeper_y }
        : null;
    if (timeoutWinner) {
      const { outcome } = resolveAim(
        shot,
        cover,
        round.shooter_accuracy ?? 0,
        round.keeper_accuracy ?? 0,
      );
      round.outcome = outcome;
      round.resolved_at = new Date().toISOString();
      await this.persistRound(round);
      await this.closeMatch(state, timeoutWinner, "timeout");
      return;
    }

    const { outcome } = resolveAim(
      shot,
      cover,
      round.shooter_accuracy ?? (shot ? 100 : 0),
      round.keeper_accuracy ?? (cover ? 100 : 0),
    );
    round.outcome = outcome;
    round.resolved_at = new Date().toISOString();
    if (outcome === "goal") {
      if (round.shooter_id === state.match.player_a_id) {
        state.match.player_a_score += 1;
      } else {
        state.match.player_b_score += 1;
      }
    }
    const winner = matchWinner(
      state.match.player_a_score,
      state.match.player_b_score,
      round.round_number,
    );
    await this.persistRound(round);
    if (winner) {
      const winnerId =
        winner === "a" ? state.match.player_a_id : state.match.player_b_id!;
      const reason: SettleReason =
        round.round_number > REGULATION_KICKS ? "sudden_death" : "regulation";
      await this.closeMatch(state, winnerId, reason);
      return;
    }
    state.match.current_round = round.round_number + 1;
    const next = openRound(state.match, PLAYBACK_MS);
    state.rounds.push(next);
    await this.save(state);
    await this.persistRound(next);
    await this.env.DB.prepare(
      `UPDATE matches SET player_a_score = ?, player_b_score = ?, current_round = ? WHERE id = ?`,
    )
      .bind(
        state.match.player_a_score,
        state.match.player_b_score,
        state.match.current_round,
        state.match.id,
      )
      .run();
    this.broadcast(state);
    await this.schedule(state);
  }

  private async closeMatch(
    state: Stored,
    winnerId: string,
    reason: SettleReason,
  ) {
    const now = new Date().toISOString();
    state.match.status = "completed";
    state.match.winner_id = winnerId;
    state.match.completed_at = now;
    if (state.escrow) {
      state.escrow.status = "released";
      state.escrow.released_at = now;
    }
    await this.save(state);
    await this.releaseEscrow(state, winnerId, reason);
    this.broadcast(state);
    await this.ctx.storage.deleteAlarm();
  }

  private async persistRound(round: Round) {
    await persistRoundRow(this.env.DB, round);
  }

  private async releaseEscrow(
    state: Stored,
    winnerId: string,
    reason: SettleReason,
  ) {
    await settleMatchKobo(this.env.DB, state.match, winnerId, reason);
  }
}
