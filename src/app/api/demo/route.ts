import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError, requireUser } from "@/lib/cf/session";
import { CPU_ID } from "@/lib/constants";
import type { Match, MatchView } from "@/lib/game/types";
import { isTeamId, type TeamId } from "@/lib/teams";

type MatchStub = {
  start(init: {
    match: Match;
    playerA: MatchView["playerA"];
    playerB: MatchView["playerB"];
  }): Promise<Match>;
};

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const body = (await request.json().catch(() => ({}))) as { teamId?: string };
    const teamId: TeamId = isTeamId(body.teamId) ? body.teamId : user.team_id;

    const live = await env.DB.prepare(
      `SELECT id, player_b_id, status FROM matches
       WHERE status IN ('waiting', 'active')
         AND (player_a_id = ? OR player_b_id = ?)
       LIMIT 1`,
    )
      .bind(user.id, user.id)
      .first<{ id: string; player_b_id: string | null; status: string }>();

    if (live?.status === "active") {
      return Response.json({ match: { id: live.id } });
    }
    if (live?.status === "waiting") {
      return jsonError("Cancel your open challenge first", 409);
    }

    const matchId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO matches (
        id, stake_amount, player_a_id, player_b_id,
        player_a_team, player_b_team, status, current_round, started_at
      ) VALUES (?, 500, ?, ?, ?, 'away', 'active', 1, datetime('now'))`,
    )
      .bind(matchId, user.id, CPU_ID, teamId)
      .run();

    const match: Match = {
      id: matchId,
      stake_amount: 500,
      player_a_id: user.id,
      player_b_id: CPU_ID,
      player_a_team: teamId,
      player_b_team: "away",
      status: "active",
      winner_id: null,
      player_a_score: 0,
      player_b_score: 0,
      current_round: 1,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
    };

    const stub = env.MATCH.getByName(matchId) as unknown as MatchStub;
    await stub.start({
      match,
      playerA: {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        team_id: teamId,
      },
      playerB: {
        id: CPU_ID,
        full_name: "CPU",
        avatar_url: null,
        team_id: "away",
      },
    });

    return Response.json({ match: { id: matchId } });
  });
}
