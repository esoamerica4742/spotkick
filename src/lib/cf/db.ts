import { persistRound as persistRoundRow, settleMatchKobo } from "./ledger";
import { CPU_ID, CHOICE_WINDOW_MS } from "../constants";
import { runupForViewer, shooterForKick } from "../game/engine";
import { buildTurn } from "../game/turn";
import type {
  EscrowLedger,
  Match,
  MatchStatus,
  MatchView,
  Profile,
  Round,
  Wallet,
} from "../game/types";
import { coerceTeamId, type TeamId } from "../teams";

export type MatchRow = {
  id: string;
  stake_amount: number;
  player_a_id: string;
  player_b_id: string | null;
  player_a_team: string;
  player_b_team: string | null;
  status: MatchStatus;
  winner_id: string | null;
  player_a_score: number;
  player_b_score: number;
  current_round: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function asTeam(value: string | null | undefined): TeamId {
  return coerceTeamId(value);
}

export function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    stake_amount: Number(row.stake_amount),
    player_a_id: row.player_a_id,
    player_b_id: row.player_b_id,
    player_a_team: asTeam(row.player_a_team),
    player_b_team: row.player_b_team ? asTeam(row.player_b_team) : null,
    status: row.status,
    winner_id: row.winner_id,
    player_a_score: Number(row.player_a_score),
    player_b_score: Number(row.player_b_score),
    current_round: Number(row.current_round),
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

export async function getWallet(db: D1Database, userId: string): Promise<Wallet> {
  const row = await db
    .prepare(
      `SELECT user_id, balance, ledger_balance, updated_at FROM wallets WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{
      user_id: string;
      balance: number;
      ledger_balance: number;
      updated_at: string;
    }>();
  if (!row) {
    return {
      id: userId,
      user_id: userId,
      balance: 0,
      ledger_balance: 0,
      updated_at: new Date().toISOString(),
    };
  }
  return {
    id: row.user_id,
    user_id: row.user_id,
    balance: Number(row.balance),
    ledger_balance: Number(row.ledger_balance),
    updated_at: row.updated_at,
  };
}

export async function depositWallet(
  db: D1Database,
  userId: string,
  amount: number,
): Promise<Wallet> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE wallets
         SET balance = balance + ?, updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(amount, userId),
  ]);
  if (!results[0]?.success) {
    throw new Error("Deposit failed");
  }
  return getWallet(db, userId);
}

export async function setUserTeam(
  db: D1Database,
  userId: string,
  teamId: TeamId,
) {
  await db
    .prepare(`UPDATE users SET team_id = ? WHERE id = ?`)
    .bind(teamId, userId)
    .run();
}

async function profile(
  db: D1Database,
  userId: string | null,
): Promise<Pick<Profile, "id" | "full_name" | "avatar_url" | "team_id"> | null> {
  if (!userId) return null;
  if (userId === CPU_ID) {
    return {
      id: CPU_ID,
      full_name: "CPU",
      avatar_url: null,
      team_id: "away",
    };
  }
  const row = await db
    .prepare(
      `SELECT id, full_name, avatar_url, team_id FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<{
      id: string;
      full_name: string;
      avatar_url: string | null;
      team_id: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    team_id: asTeam(row.team_id),
  };
}

export async function getMatchRow(db: D1Database, matchId: string) {
  return db
    .prepare(`SELECT * FROM matches WHERE id = ?`)
    .bind(matchId)
    .first<MatchRow>();
}

export async function listRounds(db: D1Database, matchId: string): Promise<Round[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM rounds WHERE match_id = ? ORDER BY round_number ASC`,
    )
    .bind(matchId)
    .all<Round>();
  return (results ?? []).map((round) => ({
    ...round,
    round_number: Number(round.round_number),
    shooter_accuracy:
      round.shooter_accuracy == null ? null : Number(round.shooter_accuracy),
    keeper_accuracy:
      round.keeper_accuracy == null ? null : Number(round.keeper_accuracy),
    shooter_x: round.shooter_x == null ? null : Number(round.shooter_x),
    shooter_y: round.shooter_y == null ? null : Number(round.shooter_y),
    keeper_x: round.keeper_x == null ? null : Number(round.keeper_x),
    keeper_y: round.keeper_y == null ? null : Number(round.keeper_y),
  }));
}

export function maskRound(round: Round, userId: string): Round {
  if (round.outcome !== "pending") return round;
  return {
    ...round,
    shooter_choice: round.shooter_id === userId ? round.shooter_choice : null,
    keeper_choice: round.keeper_id === userId ? round.keeper_choice : null,
    shooter_accuracy: round.shooter_id === userId ? round.shooter_accuracy : null,
    keeper_accuracy: round.keeper_id === userId ? round.keeper_accuracy : null,
    shooter_x: round.shooter_id === userId ? round.shooter_x : null,
    shooter_y: round.shooter_id === userId ? round.shooter_y : null,
    keeper_x: round.keeper_id === userId ? round.keeper_x : null,
    keeper_y: round.keeper_id === userId ? round.keeper_y : null,
  };
}

export async function buildMatchView(
  db: D1Database,
  match: Match,
  userId: string,
  rounds: Round[],
): Promise<MatchView> {
  const live =
    rounds.find((round) => round.round_number === match.current_round) ?? null;
  const masked = rounds.map((round) => maskRound(round, userId));
  const current =
    masked.find((round) => round.round_number === match.current_round) ?? null;
  const [playerA, playerB, escrow] = await Promise.all([
    profile(db, match.player_a_id),
    profile(db, match.player_b_id),
    db
      .prepare(`SELECT * FROM escrow_ledger WHERE match_id = ?`)
      .bind(match.id)
      .first<EscrowLedger>(),
  ]);
  const runup = runupForViewer(live, userId);
  return {
    match,
    rounds: masked,
    playerA: playerA ?? {
      id: match.player_a_id,
      full_name: "Player",
      avatar_url: null,
      team_id: match.player_a_team,
    },
    playerB: playerB,
    escrow: escrow
      ? {
          ...escrow,
          total_pool: Number(escrow.total_pool),
          platform_rake: Number(escrow.platform_rake),
          payout_amount: Number(escrow.payout_amount),
        }
      : null,
    myRole: current
      ? current.shooter_id === userId
        ? "shooter"
        : "keeper"
      : null,
    currentRound: current,
    isStriker: Boolean(current && current.shooter_id === userId),
    kickerLocked: Boolean(live && live.shooter_x != null),
    runupX: runup?.x ?? null,
    runupY: runup?.y ?? null,
    chat: [],
    oppHere: false,
    humanDuel: Boolean(match.player_b_id && match.player_b_id !== CPU_ID),
    turn: buildTurn(match, current, userId),
  };
}

export function openRoundRow(
  matchId: string,
  roundNumber: number,
  playerAId: string,
  playerBId: string,
  delayMs: number,
): Round {
  const { shooterId, keeperId } = shooterForKick(
    roundNumber,
    playerAId,
    playerBId,
  );
  const opens = Date.now() + delayMs;
  return {
    id: crypto.randomUUID(),
    match_id: matchId,
    round_number: roundNumber,
    shooter_id: shooterId,
    keeper_id: keeperId,
    shooter_choice: null,
    keeper_choice: null,
    shooter_accuracy: null,
    keeper_accuracy: null,
    shooter_x: null,
    shooter_y: null,
    keeper_x: null,
    keeper_y: null,
    outcome: "pending",
    choice_opens_at: new Date(opens).toISOString(),
    choice_closes_at: new Date(opens + CHOICE_WINDOW_MS).toISOString(),
    resolved_at: null,
  };
}

export async function persistRound(db: D1Database, round: Round) {
  await persistRoundRow(db, round);
}

export async function releaseEscrowBatch(
  db: D1Database,
  match: Match,
  winnerId: string,
  _payout: number,
  reason: "regulation" | "sudden_death" | "forfeit" | "timeout" = "forfeit",
) {
  await settleMatchKobo(db, match, winnerId, reason);
}

export async function refundWaitingMatch(db: D1Database, match: MatchRow, userId: string) {
  await db.batch([
    db
      .prepare(
        `UPDATE matches SET status = 'cancelled', completed_at = datetime('now')
         WHERE id = ? AND status = 'waiting' AND player_a_id = ? AND player_b_id IS NULL`,
      )
      .bind(match.id, userId),
    db
      .prepare(
        `UPDATE wallets
         SET balance = balance + ?,
             ledger_balance = MAX(0, ledger_balance - ?),
             updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(match.stake_amount, match.stake_amount, userId),
  ]);
}

