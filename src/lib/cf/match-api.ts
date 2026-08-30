import { getMatchRow, mapMatch } from "./db";
import { settleMatchKobo } from "./ledger";
import { jsonError, requireUser, type SessionUser } from "./session";
import { CPU_ID, ZONES, isValidStake, poolName, type Zone } from "../constants";
import { clampAccuracy } from "../game/engine";
import type { Match, MatchView } from "../game/types";
import { isTeamId, type TeamId } from "../teams";

type PoolStub = {
  join(
    userId: string,
    stake: number,
    teamId: TeamId,
    origin?: string,
  ): Promise<{ match: Match; bountyId: string | null }>;
  cancel(userId: string): Promise<void>;
};

type MatchStub = {
  getView(userId: string): Promise<MatchView | null>;
  forfeit(userId: string): Promise<MatchView>;
  submitAction(input: {
    userId: string;
    role: "kicker" | "keeper";
    direction?: Zone;
    x?: number;
    y?: number;
    accuracyScore: number;
    clientTs?: number;
  }): Promise<MatchView>;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function joinMatch(request: Request, env: CloudflareEnv) {
  const user = await requireUser(env.DB, request);
  const body = await readBody(request);
  const stake = Number(body.stake);
  if (!isValidStake(stake)) return jsonError("Invalid stake");
  const teamId =
    typeof body.teamId === "string" && isTeamId(body.teamId)
      ? body.teamId
      : user.team_id;
  await env.DB.prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
    .bind(teamId, user.id)
    .run();
  const origin = new URL(request.url).origin;
  const stub = env.MATCHMAKER.getByName(poolName(stake)) as unknown as PoolStub;
  const result = await stub.join(user.id, stake, teamId, origin);
  return json({
    matchId: result.match.id,
    match: result.match,
    bountyId: result.bountyId,
  });
}

export async function submitMatchAction(request: Request, env: CloudflareEnv) {
  const user = await requireUser(env.DB, request);
  const body = await readBody(request);
  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  if (!matchId) return jsonError("matchId required");
  if (typeof body.playerId === "string" && body.playerId !== user.id) {
    return jsonError("playerId does not match session", 403);
  }
  const role = body.role === "kicker" || body.role === "keeper" ? body.role : null;
  if (!role) return jsonError("role must be kicker or keeper");
  const x = typeof body.x === "number" ? body.x : undefined;
  const y = typeof body.y === "number" ? body.y : undefined;
  const direction = body.direction as Zone | undefined;
  if (
    (x == null || y == null) &&
    !(direction && ZONES.includes(direction))
  ) {
    return jsonError("Aim point required");
  }
  const accuracyScore = clampAccuracy(body.accuracyScore, NaN);
  if (!Number.isFinite(accuracyScore)) {
    return jsonError("accuracyScore must be 0-100");
  }
  const clientTs =
    typeof body.clientTs === "number" && Number.isFinite(body.clientTs)
      ? body.clientTs
      : undefined;
  const stub = env.MATCH.getByName(matchId) as unknown as MatchStub;
  const view = await stub.submitAction({
    userId: user.id,
    role,
    direction,
    x,
    y,
    accuracyScore,
    clientTs,
  });
  return json({ view });
}

export async function forfeitMatchById(
  env: CloudflareEnv,
  _request: Request,
  user: SessionUser,
  matchId: string,
) {
  const stub = env.MATCH.getByName(matchId) as unknown as MatchStub;
  const live = await stub.getView(user.id);

  if (live?.match.status === "active") {
    const view = await stub.forfeit(user.id);
    return json({ view, result: "forfeit" });
  }
  if (
    live &&
    (live.match.status === "completed" || live.match.status === "cancelled")
  ) {
    return json({ view: live, result: "noop" });
  }

  const row = await getMatchRow(env.DB, matchId);
  if (!row) return jsonError("Match not found", 404);
  if (row.player_a_id !== user.id && row.player_b_id !== user.id) {
    return jsonError("Not a participant", 403);
  }

  if (row.status === "waiting") {
    try {
      const pool = env.MATCHMAKER.getByName(
        poolName(row.stake_amount),
      ) as unknown as PoolStub;
      await pool.cancel(user.id);
    } catch {
      const raced = await stub.getView(user.id);
      if (raced?.match.status === "active") {
        const view = await stub.forfeit(user.id);
        return json({ view, result: "forfeit" });
      }
      throw new Error("Could not cancel queue");
    }
    return json({ result: "cancelled" });
  }

  if (row.status === "active") {
    try {
      const view = await stub.forfeit(user.id);
      return json({ view, result: "forfeit" });
    } catch {
      const winnerId =
        row.player_a_id === user.id ? row.player_b_id : row.player_a_id;
      if (!winnerId || winnerId === CPU_ID) {
        return jsonError("Could not forfeit match");
      }
      await settleMatchKobo(env.DB, mapMatch(row), winnerId, "forfeit");
      return json({ result: "forfeit" });
    }
  }

  return json({ result: "noop" });
}

export async function forfeitMatch(request: Request, env: CloudflareEnv) {
  const user = await requireUser(env.DB, request);
  const url = new URL(request.url);
  const body = await readBody(request);
  const matchId =
    (typeof body.matchId === "string" && body.matchId) ||
    url.pathname.match(/^\/api\/match\/([^/]+)\/forfeit$/)?.[1] ||
    "";
  if (!matchId) return jsonError("matchId required");
  return forfeitMatchById(env, request, user, matchId);
}

export async function dispatchMatchApi(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  if (request.method !== "POST") return null;
  const path = new URL(request.url).pathname;
  try {
    if (path === "/api/match/join") return await joinMatch(request, env);
    if (path === "/api/match/submit-action") {
      return await submitMatchAction(request, env);
    }
    if (path === "/api/match/forfeit") return await forfeitMatch(request, env);
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(
      error instanceof Error ? error.message : "Server error",
      500,
    );
  }
  return null;
}
