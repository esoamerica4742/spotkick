import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { listOpenMarketRooms } from "@/lib/cf/open-markets";
import { requireUser } from "@/lib/cf/session";
import { isValidStake, poolName } from "@/lib/constants";
import { isTeamId, type TeamId } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const rooms = await listOpenMarketRooms(env, user.id, {
      limit: 80,
      sort: "newest",
    });
    return Response.json({ rooms });
  });
}

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json()) as { stake?: number; teamId?: string };
    const stake = Number(body.stake);
    if (!isValidStake(stake)) {
      return Response.json({ error: "Stake must be ₦500–₦50,000" }, { status: 400 });
    }
    const teamId = isTeamId(body.teamId) ? body.teamId : user.team_id;
    await env.DB.prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
      .bind(teamId, user.id)
      .run();
    const origin = new URL(request.url).origin;
    const stub = env.MATCHMAKER.getByName(poolName(stake)) as unknown as {
      join(
        userId: string,
        stake: number,
        teamId: TeamId,
        origin?: string,
      ): Promise<{ match: { id: string } }>;
    };
    const result = await stub.join(user.id, stake, teamId, origin);
    return Response.json(result);
  });
}
