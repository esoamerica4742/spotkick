import { REGULATION_KICKS } from "../constants";
import type { Match, Round } from "./types";

export type TurnState = {
  round: number;
  kick: number;
  isStriker: boolean;
  score: string;
  closesAt: string | null;
  remainingMs: number;
};

export function kickToRound(kick: number): number {
  if (kick <= REGULATION_KICKS) return Math.max(1, Math.ceil(kick / 2));
  return 3 + Math.ceil((kick - REGULATION_KICKS) / 2);
}

export function buildTurn(
  match: Match,
  current: Round | null,
  userId: string,
  now = Date.now(),
): TurnState {
  const kick = match.current_round;
  const youAreA = userId === match.player_a_id;
  const you = youAreA ? match.player_a_score : match.player_b_score;
  const opp = youAreA ? match.player_b_score : match.player_a_score;
  const closesAt =
    current && current.outcome === "pending" ? current.choice_closes_at : null;
  return {
    round: kickToRound(kick),
    kick,
    isStriker: Boolean(current && current.shooter_id === userId),
    score: `${you}:${opp}`,
    closesAt,
    remainingMs: closesAt
      ? Math.max(0, new Date(closesAt).getTime() - now)
      : 0,
  };
}
