import { poolName } from "@/lib/constants";
import {
  toMarketRoom,
  type MarketRoom,
  type MarketRoomRow,
} from "@/lib/market";

type PoolStub = {
  cancel(userId: string): Promise<void>;
};

export type MarketSort = "highest" | "newest";

export async function expireGhostRooms(env: CloudflareEnv) {
  const { results } = await env.DB.prepare(
    `SELECT id, player_a_id, stake_amount FROM matches
     WHERE status = 'waiting' AND player_b_id IS NULL
       AND created_at <= datetime('now', '-3 minutes')`,
  ).all<{ id: string; player_a_id: string; stake_amount: number }>();
  for (const row of results ?? []) {
    try {
      const stub = env.MATCHMAKER.getByName(
        poolName(row.stake_amount),
      ) as unknown as PoolStub;
      await stub.cancel(row.player_a_id);
    } catch {
      // Room may already be gone.
    }
  }
}

export async function listOpenMarketRooms(
  env: CloudflareEnv,
  userId: string,
  opts: { limit: number; sort: MarketSort },
): Promise<MarketRoom[]> {
  await expireGhostRooms(env);
  const highest = `SELECT m.id, m.player_a_id, m.player_a_team, m.stake_amount, m.created_at,
            u.full_name, u.avatar_url
     FROM matches m
     JOIN users u ON u.id = m.player_a_id
     WHERE m.status = 'waiting' AND m.player_b_id IS NULL
     ORDER BY m.stake_amount DESC, m.created_at DESC
     LIMIT ?`;
  const newest = `SELECT m.id, m.player_a_id, m.player_a_team, m.stake_amount, m.created_at,
            u.full_name, u.avatar_url
     FROM matches m
     JOIN users u ON u.id = m.player_a_id
     WHERE m.status = 'waiting' AND m.player_b_id IS NULL
     ORDER BY m.created_at DESC
     LIMIT ?`;
  const { results } = await env.DB.prepare(
    opts.sort === "highest" ? highest : newest,
  )
    .bind(opts.limit)
    .all<MarketRoomRow>();
  return (results ?? []).map((row) => toMarketRoom(row, userId));
}
