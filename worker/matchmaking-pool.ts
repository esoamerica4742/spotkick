import { DurableObject } from "cloudflare:workers";
import {
  MARKET_TTL_MS,
  isValidStake,
} from "../src/lib/constants";
import { bountyUrl, flashBountyClipboard } from "../src/lib/bounty";
import { rakeAndPayout } from "../src/lib/game/engine";
import type { Match } from "../src/lib/game/types";
import {
  DEFAULT_TEAM_ID,
  coerceTeamId,
  matchPriority,
  type TeamId,
} from "../src/lib/teams";
import type { MatchInit } from "./match-object";

type UserRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  team_id: string;
};

export type Seat = {
  userId: string;
  teamId: TeamId;
  fullName: string;
  matchId: string;
  joinedAt: number;
  bountyId: string | null;
  origin: string;
};

function team(value: string | null | undefined): TeamId {
  return coerceTeamId(value);
}

function originOf(request: Request | null): string {
  if (!request) return "";
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded ?? url.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    url.protocol.replace(":", "") ??
    "https";
  return `${proto}://${host}`;
}

export class MatchmakingPool extends DurableObject<CloudflareEnv> {
  private seats: Seat[] = [];
  private loaded = false;

  private async ensure() {
    if (this.loaded) return;
    this.seats = (await this.ctx.storage.get<Seat[]>("seats")) ?? [];
    this.loaded = true;
  }

  private async persist() {
    await this.ctx.storage.put("seats", this.seats);
  }

  private send(userId: string, payload: unknown) {
    const body = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { userId?: string } | null;
      if (att?.userId !== userId) continue;
      try {
        ws.send(body);
      } catch {
        // Socket already closed.
      }
    }
  }

  private async scheduleAlarm() {
    const waiting = this.seats.filter((seat) => !seat.bountyId);
    if (!waiting.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const next = Math.min(
      ...waiting.map((seat) => seat.joinedAt + MARKET_TTL_MS),
    );
    await this.ctx.storage.setAlarm(next);
  }

  async join(
    userId: string,
    stake: number,
    teamId: TeamId,
    origin = "",
  ): Promise<{ match: Match; bountyId: string | null }> {
    if (!isValidStake(stake)) {
      throw new Error("Invalid stake");
    }
    await this.ensure();
    await this.hydrate(stake);

    const live = await this.env.DB.prepare(
      `SELECT id FROM matches
       WHERE status IN ('waiting', 'active')
         AND (player_a_id = ? OR player_b_id = ?)
       LIMIT 1`,
    )
      .bind(userId, userId)
      .first<{ id: string }>();
    if (live) {
      const match = await this.readMatch(live.id);
      const existing = this.seats.find((seat) => seat.userId === userId);
      if (match.status === "waiting" && !existing) {
        const profile = await this.readUser(userId);
        this.seats.push({
          userId,
          teamId,
          fullName: profile.full_name ?? "Player",
          matchId: match.id,
          joinedAt: Date.parse(match.created_at) || Date.now(),
          bountyId: null,
          origin,
        });
        await this.persist();
        await this.scheduleAlarm();
      }
      return { match, bountyId: existing?.bountyId ?? null };
    }

    const match = await this.enqueue(userId, teamId, stake);
    const profile = await this.readUser(userId);
    this.seats = this.seats.filter((seat) => seat.userId !== userId);
    this.seats.push({
      userId,
      teamId,
      fullName: profile.full_name ?? "Player",
      matchId: match.id,
      joinedAt: Date.now(),
      bountyId: null,
      origin,
    });
    await this.persist();
    await this.scheduleAlarm();
    this.send(userId, { type: "queued", match, waitMs: MARKET_TTL_MS });
    return { match, bountyId: null };
  }

  async cancel(userId: string) {
    await this.ensure();
    const seat = this.seats.find((item) => item.userId === userId);
    const waiting = await this.env.DB.prepare(
      `SELECT id, stake_amount FROM matches
       WHERE status = 'waiting' AND player_a_id = ? AND player_b_id IS NULL`,
    )
      .bind(userId)
      .first<{ id: string; stake_amount: number }>();
    if (!waiting) {
      this.seats = this.seats.filter((item) => item.userId !== userId);
      await this.persist();
      return;
    }
    const statements = [
      this.env.DB.prepare(
        `UPDATE matches
         SET status = 'cancelled', completed_at = datetime('now')
         WHERE id = ? AND status = 'waiting' AND player_a_id = ? AND player_b_id IS NULL`,
      ).bind(waiting.id, userId),
      this.env.DB.prepare(
        `UPDATE wallets
         SET balance = balance + ?,
             ledger_balance = MAX(0, ledger_balance - ?),
             updated_at = datetime('now')
         WHERE user_id = ?`,
      ).bind(waiting.stake_amount, waiting.stake_amount, userId),
    ];
    if (seat?.bountyId) {
      statements.push(
        this.env.DB.prepare(
          `UPDATE bounties SET status = 'cancelled' WHERE id = ? AND status = 'open'`,
        ).bind(seat.bountyId),
      );
    }
    const results = await this.env.DB.batch(statements);
    if ((results[0]?.meta.changes ?? 0) !== 1) {
      throw new Error("Could not cancel queue");
    }
    this.seats = this.seats.filter((item) => item.userId !== userId);
    await this.persist();
    await this.scheduleAlarm();
    this.send(userId, { type: "cancelled" });
  }

  async claimBounty(
    bountyId: string,
    userId: string,
    teamId: TeamId,
  ): Promise<Match> {
    await this.ensure();
    const bounty = await this.env.DB.prepare(
      `SELECT * FROM bounties WHERE id = ? AND status = 'open'`,
    )
      .bind(bountyId)
      .first<{
        id: string;
        creator_id: string;
        match_id: string;
        stake_amount: number;
      }>();
    if (!bounty) throw new Error("Bounty is no longer open");
    if (bounty.creator_id === userId) throw new Error("This is your bounty");

    const match = await this.claim(
      bounty.match_id,
      userId,
      teamId,
      bounty.stake_amount,
    );
    await this.env.DB.prepare(
      `UPDATE bounties
       SET status = 'claimed', claimed_at = datetime('now'), claimed_by = ?
       WHERE id = ? AND status = 'open'`,
    )
      .bind(userId, bountyId)
      .run();
    this.seats = this.seats.filter(
      (seat) => seat.userId !== userId && seat.userId !== bounty.creator_id,
    );
    await this.persist();
    await this.scheduleAlarm();
    this.send(bounty.creator_id, { type: "matched", match });
    this.send(userId, { type: "matched", match });
    return match;
  }

  async accept(
    matchId: string,
    userId: string,
    teamId: TeamId,
  ): Promise<Match> {
    await this.ensure();
    const waiting = await this.readMatch(matchId);
    if (waiting.status !== "waiting" || waiting.player_b_id) {
      throw new Error("Match already taken");
    }
    if (waiting.player_a_id === userId) {
      throw new Error("This is your challenge");
    }
    await this.hydrate(waiting.stake_amount);
    const match = await this.claim(
      matchId,
      userId,
      teamId,
      waiting.stake_amount,
    );
    this.seats = this.seats.filter(
      (seat) => seat.userId !== userId && seat.userId !== waiting.player_a_id,
    );
    await this.persist();
    await this.scheduleAlarm();
    this.send(waiting.player_a_id, { type: "matched", match });
    this.send(userId, { type: "matched", match });
    return match;
  }

  async alarm() {
    await this.ensure();
    const now = Date.now();
    const stale = this.seats.filter(
      (seat) => now >= seat.joinedAt + MARKET_TTL_MS,
    );
    for (const seat of stale) {
      try {
        await this.cancel(seat.userId);
      } catch {
        this.seats = this.seats.filter((item) => item.userId !== seat.userId);
      }
    }
    await this.persist();
    await this.scheduleAlarm();
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const userId = request.headers.get("X-Spotkick-User");
    if (!userId) return new Response("Unauthorized", { status: 401 });
    await this.ensure();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId });
    const origin = originOf(request);
    const seat = this.seats.find((item) => item.userId === userId);
    if (seat) {
      seat.origin = origin || seat.origin;
      await this.persist();
      const match = await this.readMatch(seat.matchId).catch(() => null);
      const waitMs = Math.max(
        0,
        seat.joinedAt + MARKET_TTL_MS - Date.now(),
      );
      let bounty = null;
      if (seat.bountyId) {
        bounty = await this.bountyPayload(seat, origin);
      }
      server.send(
        JSON.stringify({
          type: "queued",
          match,
          waitMs,
          bounty,
          shareText: bounty
            ? flashBountyClipboard({
                stake: match?.stake_amount ?? 0,
                teamId: seat.teamId,
                url: bounty.share_url,
              })
            : null,
        }),
      );
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as { userId?: string } | null;
    if (!att?.userId) return;
    const text =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    let payload: { type?: string };
    try {
      payload = JSON.parse(text) as { type?: string };
    } catch {
      return;
    }
    if (payload.type === "sync") {
      await this.ensure();
      const seat = this.seats.find((item) => item.userId === att.userId);
      if (!seat) return;
      const match = await this.readMatch(seat.matchId).catch(() => null);
      ws.send(
        JSON.stringify({
          type: "queued",
          match,
          waitMs: Math.max(0, seat.joinedAt + MARKET_TTL_MS - Date.now()),
        }),
      );
    }
  }

  async webSocketClose(ws: WebSocket) {
    ws.close();
  }

  private pickOpponent(teamId: TeamId, userId: string): Seat | null {
    const others = this.seats.filter((seat) => seat.userId !== userId);
    if (!others.length) return null;
    return [...others].sort((a, b) => {
      const rank =
        matchPriority(teamId, a.teamId) - matchPriority(teamId, b.teamId);
      if (rank !== 0) return rank;
      return a.joinedAt - b.joinedAt;
    })[0]!;
  }

  private async hydrate(stake: number) {
    if (this.seats.length) return;
    const { results } = await this.env.DB.prepare(
      `SELECT m.id, m.player_a_id, m.created_at, m.player_a_team, u.full_name,
              b.id AS bounty_id
       FROM matches m
       JOIN users u ON u.id = m.player_a_id
       LEFT JOIN bounties b ON b.match_id = m.id AND b.status = 'open'
       WHERE m.status = 'waiting' AND m.stake_amount = ? AND m.player_b_id IS NULL`,
    )
      .bind(stake)
      .all<{
        id: string;
        player_a_id: string;
        created_at: string;
        player_a_team: string;
        full_name: string;
        bounty_id: string | null;
      }>();
    this.seats = (results ?? []).map((row) => ({
      userId: row.player_a_id,
      teamId: team(row.player_a_team),
      fullName: row.full_name,
      matchId: row.id,
      joinedAt: Date.parse(row.created_at) || Date.now(),
      bountyId: row.bounty_id,
      origin: "",
    }));
    await this.persist();
  }

  private async convertBounty(seat: Seat, origin: string) {
    const match = await this.readMatch(seat.matchId).catch(() => null);
    if (!match || match.status !== "waiting") return;
    const shareOrigin = origin || "https://spotkick.esoamerica4742.workers.dev";
    const existing = await this.env.DB.prepare(
      `SELECT id FROM bounties WHERE match_id = ? AND status = 'open'`,
    )
      .bind(seat.matchId)
      .first<{ id: string }>();
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      await this.env.DB.prepare(
        `INSERT INTO bounties (
           id, creator_id, stake_amount, team_id, match_id, status
         ) VALUES (?, ?, ?, ?, ?, 'open')`,
      )
        .bind(id, seat.userId, match.stake_amount, seat.teamId, seat.matchId)
        .run();
    }
    seat.bountyId = id;
    const url = bountyUrl(shareOrigin, id);
    const shareText = flashBountyClipboard({
      stake: match.stake_amount,
      teamId: seat.teamId,
      url,
    });
    this.send(seat.userId, {
      type: "bounty",
      bounty: {
        id,
        creator_id: seat.userId,
        creator_name: seat.fullName,
        stake_amount: match.stake_amount,
        team_id: seat.teamId,
        match_id: seat.matchId,
        status: "open",
        share_url: url,
        created_at: new Date().toISOString(),
        claimed_at: null,
        claimed_by: null,
      },
      shareText,
    });
  }

  private async bountyPayload(seat: Seat, origin: string) {
    if (!seat.bountyId) return null;
    const url = bountyUrl(
      origin || "https://spotkick.esoamerica4742.workers.dev",
      seat.bountyId,
    );
    return {
      id: seat.bountyId,
      share_url: url,
      team_id: seat.teamId,
    };
  }

  private async claim(
    matchId: string,
    userId: string,
    teamId: TeamId,
    stake: number,
  ): Promise<Match> {
    const { totalPool, platformRake, payoutAmount } = rakeAndPayout(stake, 2);
    const results = await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE wallets
         SET balance = balance - ?, ledger_balance = ledger_balance + ?,
             updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`,
      ).bind(stake, stake, userId, stake),
      this.env.DB.prepare(
        `UPDATE matches
         SET player_b_id = ?, player_b_team = ?, status = 'active',
             started_at = datetime('now')
         WHERE id = ? AND status = 'waiting' AND player_b_id IS NULL`,
      ).bind(userId, teamId, matchId),
      this.env.DB.prepare(
        `INSERT INTO escrow_ledger
          (id, match_id, total_pool, platform_rake, payout_amount, status)
         VALUES (?, ?, ?, ?, ?, 'held')`,
      ).bind(crypto.randomUUID(), matchId, totalPool, platformRake, payoutAmount),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1) {
      throw new Error("Insufficient balance");
    }
    if ((results[1]?.meta.changes ?? 0) !== 1) {
      await this.env.DB.prepare(
        `UPDATE wallets
         SET balance = balance + ?, ledger_balance = MAX(0, ledger_balance - ?),
             updated_at = datetime('now')
         WHERE user_id = ?`,
      )
        .bind(stake, stake, userId)
        .run();
      throw new Error("Match already taken");
    }
    const match = await this.readMatch(matchId);
    const [playerA, playerB] = await Promise.all([
      this.readUser(match.player_a_id),
      this.readUser(userId),
    ]);
    await this.startMatch(match, playerA, playerB);
    return match;
  }

  private async enqueue(
    userId: string,
    teamId: TeamId,
    stake: number,
  ): Promise<Match> {
    const matchId = crypto.randomUUID();
    const results = await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE wallets
         SET balance = balance - ?, ledger_balance = ledger_balance + ?,
             updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`,
      ).bind(stake, stake, userId, stake),
      this.env.DB.prepare(
        `INSERT INTO matches (
          id, stake_amount, player_a_id, player_a_team, status, current_round
        ) VALUES (?, ?, ?, ?, 'waiting', 1)`,
      ).bind(matchId, stake, userId, teamId),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1) {
      throw new Error("Insufficient balance");
    }
    return this.readMatch(matchId);
  }

  private async readMatch(id: string): Promise<Match> {
    const row = await this.env.DB.prepare(`SELECT * FROM matches WHERE id = ?`)
      .bind(id)
      .first<{
        id: string;
        stake_amount: number;
        player_a_id: string;
        player_b_id: string | null;
        player_a_team: string;
        player_b_team: string | null;
        status: Match["status"];
        winner_id: string | null;
        player_a_score: number;
        player_b_score: number;
        current_round: number;
        created_at: string;
        started_at: string | null;
        completed_at: string | null;
      }>();
    if (!row) throw new Error("Match not found");
    return {
      id: row.id,
      stake_amount: Number(row.stake_amount),
      player_a_id: row.player_a_id,
      player_b_id: row.player_b_id,
      player_a_team: team(row.player_a_team),
      player_b_team: row.player_b_team ? team(row.player_b_team) : null,
      status: row.status,
      winner_id: row.winner_id,
      player_a_score: Number(row.player_a_score),
      player_b_score: Number(row.player_b_score),
      current_round: Number(row.current_round),
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
    };
  }

  private async readUser(userId: string) {
    const row = await this.env.DB.prepare(
      `SELECT id, full_name, avatar_url, team_id FROM users WHERE id = ?`,
    )
      .bind(userId)
      .first<UserRow>();
    if (!row) {
      return {
        id: userId,
        full_name: "Player",
        avatar_url: null,
        team_id: DEFAULT_TEAM_ID,
      };
    }
    return {
      id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      team_id: team(row.team_id),
    };
  }

  private async startMatch(
    match: Match,
    playerA: MatchInit["playerA"],
    playerB: MatchInit["playerB"],
  ) {
    const stub = this.env.MATCH.getByName(match.id) as unknown as {
      start(init: MatchInit): Promise<Match>;
    };
    await stub.start({ match, playerA, playerB });
  }
}
