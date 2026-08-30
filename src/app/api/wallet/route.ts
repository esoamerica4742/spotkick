import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { getWallet } from "@/lib/cf/db";
import { requireUser } from "@/lib/cf/session";
import { coerceTeamId } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const wallet = await getWallet(env.DB, user.id);
    return Response.json({ wallet, teamId: user.team_id });
  });
}

export function PATCH(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json()) as { teamId?: string };
    if (typeof body.teamId !== "string") {
      return Response.json({ error: "Invalid team" }, { status: 400 });
    }
    const teamId = coerceTeamId(body.teamId);
    await env.DB.prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
      .bind(teamId, user.id)
      .run();
    return Response.json({ teamId });
  });
}
