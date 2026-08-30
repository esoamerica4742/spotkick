import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { requireUser } from "@/lib/cf/session";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const { results } = await env.DB.prepare(
      `SELECT status, winner_id FROM matches
       WHERE player_a_id = ? OR player_b_id = ?`,
    )
      .bind(user.id, user.id)
      .all<{ status: string; winner_id: string | null }>();
    const rows = results ?? [];
    const played = rows.filter((row) => row.status === "completed").length;
    const won = rows.filter((row) => row.winner_id === user.id).length;
    const waiting = rows.some((row) => row.status === "waiting");
    const live = rows.some((row) => row.status === "active");
    return Response.json({
      stats: { played, won, lost: Math.max(0, played - won), waiting, live },
    });
  });
}
