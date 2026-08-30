import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { buildMatchView, getMatchRow, listRounds, mapMatch } from "@/lib/cf/db";
import { jsonError, requireUser } from "@/lib/cf/session";
import type { MatchView } from "@/lib/game/types";

type MatchStub = {
  getView(userId: string): Promise<MatchView | null>;
};

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await context.params;
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const stub = env.MATCH.getByName(id) as unknown as MatchStub;
    let live: MatchView | null = null;
    try {
      live = await stub.getView(user.id);
    } catch {
      live = null;
    }
    if (live) return Response.json({ view: live });
    const row = await getMatchRow(env.DB, id);
    if (!row) return jsonError("Match not found", 404);
    if (row.player_a_id !== user.id && row.player_b_id !== user.id) {
      return jsonError("Not a participant", 403);
    }
    const view = await buildMatchView(
      env.DB,
      mapMatch(row),
      user.id,
      await listRounds(env.DB, id),
    );
    return Response.json({ view });
  });
}
