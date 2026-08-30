import { type Zone } from "@/lib/constants";
import { shooterForKick } from "@/lib/game/engine";
import type { MatchView, Role, Round } from "@/lib/game/types";

export type MatchPhase =
  | "searching"
  | "choosing"
  | "locked"
  | "playback"
  | "complete";

export function roleOnRound(round: Round, userId: string): Role {
  return round.shooter_id === userId ? "shooter" : "keeper";
}

export function roleForKick(
  kickNumber: number,
  playerAId: string,
  playerBId: string,
  userId: string,
): Role {
  const { shooterId } = shooterForKick(kickNumber, playerAId, playerBId);
  return shooterId === userId ? "shooter" : "keeper";
}

export function myLockedChoice(round: Round, userId: string): Zone | null {
  if (round.shooter_id === userId) {
    return round.shooter_x != null ? round.shooter_choice : null;
  }
  return round.keeper_x != null ? round.keeper_choice : null;
}

export function myLocked(round: Round, userId: string): boolean {
  return round.shooter_id === userId
    ? round.shooter_x != null
    : round.keeper_x != null;
}

export function choiceWindowOpen(round: Round, now = Date.now()): boolean {
  return now >= new Date(round.choice_opens_at).getTime();
}

export function latestResolvedRound(rounds: Round[]): Round | null {
  return (
    [...rounds]
      .filter((round) => round.outcome !== "pending")
      .sort((a, b) => b.round_number - a.round_number)[0] ?? null
  );
}

export function matchPhase({
  view,
  userId,
  playbackRoundId,
}: {
  view: MatchView;
  userId: string;
  playbackRoundId: string | null;
}): {
  phase: MatchPhase;
  role: Role | null;
  round: Round | null;
} {
  if (view.match.status === "waiting") {
    return { phase: "searching", role: null, round: null };
  }

  const resolved = latestResolvedRound(view.rounds);
  if (playbackRoundId && resolved?.id === playbackRoundId) {
    return {
      phase: "playback",
      role: roleOnRound(resolved, userId),
      round: resolved,
    };
  }

  if (view.match.status === "completed") {
    return { phase: "complete", role: null, round: resolved };
  }

  const current = view.currentRound;
  if (!current || current.outcome !== "pending") {
    return {
      phase: "locked",
      role: current ? roleOnRound(current, userId) : null,
      round: current,
    };
  }

  const locked = myLocked(current, userId);
  if (roleOnRound(current, userId) === "keeper" && !view.kickerLocked) {
    return {
      phase: "locked",
      role: "keeper",
      round: current,
    };
  }
  return {
    phase: locked ? "locked" : "choosing",
    role: roleOnRound(current, userId),
    round: current,
  };
}
