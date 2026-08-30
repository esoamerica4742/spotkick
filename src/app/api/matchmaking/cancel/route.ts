import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { requireUser } from "@/lib/cf/session";
import { poolName } from "@/lib/constants";

type PoolStub = { cancel(userId: string): Promise<void> };

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const waiting = await env.DB.prepare(
      `SELECT stake_amount FROM matches
       WHERE status = 'waiting' AND player_a_id = ? AND player_b_id IS NULL`,
    )
      .bind(user.id)
      .first<{ stake_amount: number }>();
    if (waiting) {
      const stub = env.MATCHMAKER.getByName(
        poolName(waiting.stake_amount),
      ) as unknown as PoolStub;
      await stub.cancel(user.id);
    }
    return Response.json({ ok: true });
  });
}
