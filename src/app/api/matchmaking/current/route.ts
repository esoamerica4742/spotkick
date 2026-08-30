import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { getMatchRow, mapMatch } from "@/lib/cf/db";
import { requireUser } from "@/lib/cf/session";
import { bountyUrl } from "@/lib/bounty";
import { coerceTeamId } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return api(async () => {
    const env = await cfEnv();
    const user = await requireUser(env.DB, request);
    const origin = new URL(request.url).origin;
    const row = await env.DB.prepare(
      `SELECT * FROM matches
       WHERE status IN ('waiting', 'active')
         AND (player_a_id = ? OR player_b_id = ?)
       ORDER BY created_at DESC
       LIMIT 1`,
    )
      .bind(user.id, user.id)
      .first<{ id: string }>();
    const stored = row ? await getMatchRow(env.DB, row.id) : null;
    const match = stored ? mapMatch(stored) : null;

    const bountyRow = await env.DB.prepare(
      `SELECT b.*, u.full_name
       FROM bounties b
       JOIN users u ON u.id = b.creator_id
       WHERE b.creator_id = ? AND b.status = 'open'
       ORDER BY b.created_at DESC
       LIMIT 1`,
    )
      .bind(user.id)
      .first<{
        id: string;
        creator_id: string;
        full_name: string;
        stake_amount: number;
        team_id: string;
        match_id: string;
        status: "open";
        created_at: string;
        claimed_at: string | null;
        claimed_by: string | null;
      }>();

    return Response.json({
      match,
      bounty: bountyRow
        ? {
            id: bountyRow.id,
            creator_id: bountyRow.creator_id,
            creator_name: bountyRow.full_name,
            stake_amount: Number(bountyRow.stake_amount),
            team_id: coerceTeamId(bountyRow.team_id),
            match_id: bountyRow.match_id,
            status: bountyRow.status,
            share_url: bountyUrl(origin, bountyRow.id),
            created_at: bountyRow.created_at,
            claimed_at: bountyRow.claimed_at,
            claimed_by: bountyRow.claimed_by,
          }
        : null,
    });
  });
}
