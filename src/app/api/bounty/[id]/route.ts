import { api } from "@/lib/cf/api";
import { cfEnv } from "@/lib/cf/context";
import { jsonError } from "@/lib/cf/session";
import { bountyUrl, type FlashBounty } from "@/lib/bounty";
import { coerceTeamId } from "@/lib/teams";

export const dynamic = "force-dynamic";

export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const { id } = await context.params;
    const env = await cfEnv();
    const origin = new URL(request.url).origin;
    const row = await env.DB.prepare(
      `SELECT b.*, u.full_name
       FROM bounties b
       JOIN users u ON u.id = b.creator_id
       WHERE b.id = ?`,
    )
      .bind(id)
      .first<{
        id: string;
        creator_id: string;
        full_name: string;
        stake_amount: number;
        team_id: string;
        match_id: string;
        status: FlashBounty["status"];
        created_at: string;
        claimed_at: string | null;
        claimed_by: string | null;
      }>();
    if (!row) return jsonError("Bounty not found", 404);
    const bounty: FlashBounty = {
      id: row.id,
      creator_id: row.creator_id,
      creator_name: row.full_name,
      stake_amount: Number(row.stake_amount),
      team_id: coerceTeamId(row.team_id),
      match_id: row.match_id,
      status: row.status,
      share_url: bountyUrl(origin, row.id),
      created_at: row.created_at,
      claimed_at: row.claimed_at,
      claimed_by: row.claimed_by,
    };
    return Response.json({ bounty });
  });
}
