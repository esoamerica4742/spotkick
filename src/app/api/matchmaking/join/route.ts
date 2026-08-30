import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError, requireUser } from "@/lib/cf/session";
import { isValidStake, poolName } from "@/lib/constants";
import { isTeamId, type TeamId } from "@/lib/teams";
import type { Match } from "@/lib/game/types";

type PoolStub = {
  join(
    userId: string,
    stake: number,
    teamId: TeamId,
    origin?: string,
  ): Promise<{ match: Match; bountyId: string | null }>;
};

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json()) as { stake?: number; teamId?: string };
    const stake = Number(body.stake);
    if (!isValidStake(stake)) {
      return jsonError("Invalid stake");
    }
    const teamId = isTeamId(body.teamId) ? body.teamId : user.team_id;
    await env.DB.prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
      .bind(teamId, user.id)
      .run();
    const origin = new URL(request.url).origin;
    const stub = env.MATCHMAKER.getByName(poolName(stake)) as unknown as PoolStub;
    const result = await stub.join(user.id, stake, teamId, origin);
    return Response.json(result);
  });
}
