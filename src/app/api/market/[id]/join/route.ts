import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError, requireUser } from "@/lib/cf/session";
import { poolName } from "@/lib/constants";
import { isTeamId, type TeamId } from "@/lib/teams";
import type { Match } from "@/lib/game/types";

type PoolStub = {
  accept(matchId: string, userId: string, teamId: TeamId): Promise<Match>;
};

export const dynamic = "force-dynamic";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { teamId?: string };
    const teamId = isTeamId(body.teamId) ? body.teamId : user.team_id;
    const row = await env.DB.prepare(
      `SELECT stake_amount FROM matches WHERE id = ? AND status = 'waiting'`,
    )
      .bind(id)
      .first<{ stake_amount: number }>();
    if (!row) return jsonError("Match already taken");
    await env.DB.prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
      .bind(teamId, user.id)
      .run();
    const stub = env.MATCHMAKER.getByName(
      poolName(Number(row.stake_amount)),
    ) as unknown as PoolStub;
    const match = await stub.accept(id, user.id, teamId);
    return Response.json({ match });
  });
}
