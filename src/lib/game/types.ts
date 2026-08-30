import type { Zone } from "../constants";
import type { TeamId } from "../teams";

export type MatchStatus = "waiting" | "active" | "completed" | "cancelled";
export type RoundOutcome = "goal" | "saved" | "pending";
export type EscrowStatus = "held" | "released" | "refunded";
export type Role = "shooter" | "keeper";

export type Profile = {
  id: string;
  phone_number: string | null;
  full_name: string | null;
  avatar_url: string | null;
  team_id: TeamId;
  created_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  ledger_balance: number;
  updated_at: string;
};

export type Match = {
  id: string;
  stake_amount: number;
  player_a_id: string;
  player_b_id: string | null;
  player_a_team: TeamId;
  player_b_team: TeamId | null;
  status: MatchStatus;
  winner_id: string | null;
  player_a_score: number;
  player_b_score: number;
  current_round: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type Round = {
  id: string;
  match_id: string;
  round_number: number;
  shooter_id: string;
  keeper_id: string;
  shooter_choice: Zone | null;
  keeper_choice: Zone | null;
  shooter_accuracy: number | null;
  keeper_accuracy: number | null;
  shooter_x: number | null;
  shooter_y: number | null;
  keeper_x: number | null;
  keeper_y: number | null;
  outcome: RoundOutcome;
  choice_opens_at: string;
  choice_closes_at: string;
  resolved_at: string | null;
};

export type EscrowLedger = {
  id: string;
  match_id: string;
  total_pool: number;
  platform_rake: number;
  payout_amount: number;
  status: EscrowStatus;
  created_at: string;
  released_at: string | null;
};

export type MatchChatMessage = {
  id: string;
  fromId: string | null;
  text: string;
  at: string;
};

export type MatchView = {
  match: Match;
  rounds: Round[];
  playerA: Pick<Profile, "id" | "full_name" | "avatar_url" | "team_id">;
  playerB: Pick<Profile, "id" | "full_name" | "avatar_url" | "team_id"> | null;
  escrow: EscrowLedger | null;
  myRole: Role | null;
  currentRound: Round | null;
  isStriker: boolean;
  kickerLocked: boolean;
  runupX: number | null;
  runupY: number | null;
  chat: MatchChatMessage[];
  oppHere: boolean;
  humanDuel: boolean;
  turn: {
    round: number;
    kick: number;
    isStriker: boolean;
    score: string;
    closesAt: string | null;
    remainingMs: number;
  };
};

export type SubmitResult = {
  accepted: boolean;
  resolved: boolean;
  outcome: RoundOutcome | null;
  matchStatus: MatchStatus;
};
