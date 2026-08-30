import { MARKET_TTL_MS } from "@/lib/constants";
import { rakeAndPayout } from "@/lib/game/engine";
import { coerceTeamId, type TeamId } from "@/lib/teams";

export type MarketRoom = {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  team_id: TeamId;
  stake_amount: number;
  payout_amount: number;
  created_at: string;
  expires_at: string;
  remaining_ms: number;
  mine: boolean;
};

export type MarketRoomRow = {
  id: string;
  player_a_id: string;
  full_name: string;
  avatar_url: string | null;
  player_a_team: string;
  stake_amount: number;
  created_at: string;
};

export function toMarketRoom(row: MarketRoomRow, userId: string): MarketRoom {
  const teamId: TeamId = coerceTeamId(row.player_a_team);
  const expiry = marketExpiry(row.created_at);
  return {
    id: row.id,
    creator_id: row.player_a_id,
    creator_name: row.full_name,
    creator_avatar: row.avatar_url,
    team_id: teamId,
    stake_amount: Number(row.stake_amount),
    payout_amount: roomPayout(Number(row.stake_amount)),
    created_at: row.created_at,
    expires_at: expiry.expiresAt,
    remaining_ms: expiry.remainingMs,
    mine: row.player_a_id === userId,
  };
}

export function parseSqliteDate(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return Date.now();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) return Date.parse(trimmed);
  return Date.parse(trimmed.replace(" ", "T") + "Z");
}

export function marketExpiry(createdAt: string): {
  expiresAt: string;
  remainingMs: number;
} {
  const created = parseSqliteDate(createdAt);
  const expires = created + MARKET_TTL_MS;
  return {
    expiresAt: new Date(expires).toISOString(),
    remainingMs: Math.max(0, expires - Date.now()),
  };
}

export function roomPayout(stake: number): number {
  return rakeAndPayout(stake).payoutAmount;
}
