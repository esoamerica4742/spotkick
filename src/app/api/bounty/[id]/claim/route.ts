import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError, requireUser } from "@/lib/cf/session";
import { poolName } from "@/lib/constants";
import { isTeamId, type TeamId } from "@/lib/teams";
import type { Match } from "@/lib/game/types";

type PoolStub = {
  claimBounty(bountyId: string, userId: string, teamId: TeamId): Promise<Match>;
};

export const dynamic = "force-dynamic";

export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await context.params;
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json().catch(() => ({}))) as { teamId?: string };
    const teamId = isTeamId(body.teamId) ? body.teamId : user.team_id;
    const bounty = await env.DB.prepare(
      `SELECT stake_amount, status FROM bounties WHERE id = ?`,
    )
      .bind(id)
      .first<{ stake_amount: number; status: string }>();
    if (!bounty) return jsonError("Bounty not found", 404);
    if (bounty.status !== "open") return jsonError("Bounty already claimed");
    const stub = env.MATCHMAKER.getByName(
      poolName(bounty.stake_amount),
    ) as unknown as PoolStub;
    const match = await stub.claimBounty(id, user.id, teamId);
    return Response.json({ match });
  });
}
