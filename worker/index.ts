import { default as handler } from "../.cf-build/.open-next/worker.js";
import { dispatchMatchApi } from "../src/lib/cf/match-api";
import { SESSION_COOKIE, isValidStake, poolName } from "../src/lib/constants";
import { MatchDurableObject } from "./match-object";
import { MatchmakerDurableObject } from "./matchmaker-object";
import { MatchmakingPool } from "./matchmaking-pool";

export { MatchDurableObject, MatchmakerDurableObject, MatchmakingPool };

async function sessionUserId(request: Request, env: CloudflareEnv) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(
    new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`),
  );
  if (!match?.[1]) return null;
  const sessionId = decodeURIComponent(match[1]);
  const row = await env.DB.prepare(
    `SELECT u.id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
  )
    .bind(sessionId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

function withUser(request: Request, userId: string) {
  const headers = new Headers(request.headers);
  headers.set("X-Spotkick-User", userId);
  return new Request(request, { headers });
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const wsMatch = url.pathname.match(/^\/api\/ws\/match\/([^/]+)$/);
    if (wsMatch) {
      const matchId = wsMatch[1]!;
      const userId = await sessionUserId(request, env);
      if (!userId) return new Response("Unauthorized", { status: 401 });
      const match = await env.DB.prepare(
        `SELECT player_a_id, player_b_id FROM matches WHERE id = ?`,
      )
        .bind(matchId)
        .first<{ player_a_id: string; player_b_id: string | null }>();
      if (
        !match ||
        (match.player_a_id !== userId && match.player_b_id !== userId)
      ) {
        return new Response("Forbidden", { status: 403 });
      }
      return env.MATCH.getByName(matchId).fetch(withUser(request, userId));
    }

    const wsPool = url.pathname.match(/^\/api\/ws\/pool\/([^/]+)$/);
    if (wsPool) {
      const stake = Number(wsPool[1]);
      if (!isValidStake(stake)) {
        return new Response("Invalid stake", { status: 400 });
      }
      const userId = await sessionUserId(request, env);
      if (!userId) return new Response("Unauthorized", { status: 401 });
      return env.MATCHMAKER.getByName(poolName(stake)).fetch(
        withUser(request, userId),
      );
    }

    const matchApi = await dispatchMatchApi(request, env);
    if (matchApi) return matchApi;

    return handler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
