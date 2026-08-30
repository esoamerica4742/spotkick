import { CPU_ID } from "../constants";
import { nairaToKobo, rakeAndPayoutKobo } from "../game/engine";
import type { Match, Round } from "../game/types";

export type SettleReason =
  | "regulation"
  | "sudden_death"
  | "forfeit"
  | "timeout";

function persistRoundSql(db: D1Database, round: Round) {
  return db
    .prepare(
      `INSERT INTO rounds (
        id, match_id, round_number, shooter_id, keeper_id,
        shooter_choice, keeper_choice, shooter_accuracy, keeper_accuracy,
        shooter_x, shooter_y, keeper_x, keeper_y,
        outcome, choice_opens_at, choice_closes_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        shooter_choice = excluded.shooter_choice,
        keeper_choice = excluded.keeper_choice,
        shooter_accuracy = excluded.shooter_accuracy,
        keeper_accuracy = excluded.keeper_accuracy,
        shooter_x = excluded.shooter_x,
        shooter_y = excluded.shooter_y,
        keeper_x = excluded.keeper_x,
        keeper_y = excluded.keeper_y,
        outcome = excluded.outcome,
        resolved_at = excluded.resolved_at`,
    )
    .bind(
      round.id,
      round.match_id,
      round.round_number,
      round.shooter_id,
      round.keeper_id,
      round.shooter_choice,
      round.keeper_choice,
      round.shooter_accuracy,
      round.keeper_accuracy,
      round.shooter_x,
      round.shooter_y,
      round.keeper_x,
      round.keeper_y,
      round.outcome,
      round.choice_opens_at,
      round.choice_closes_at,
      round.resolved_at,
    );
}

export async function persistRound(db: D1Database, round: Round) {
  await persistRoundSql(db, round).run();
}

function txSql(
  db: D1Database,
  input: {
    matchId: string;
    userId: string;
    kind: "stake_debit" | "payout" | "refund";
    amountKobo: number;
    beforeKobo: number;
    afterKobo: number;
  },
) {
  return db
    .prepare(
      `INSERT INTO wallet_transactions (
        id, match_id, user_id, kind, amount_kobo,
        balance_before_kobo, balance_after_kobo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.matchId,
      input.userId,
      input.kind,
      input.amountKobo,
      input.beforeKobo,
      input.afterKobo,
    );
}

async function walletSnapshot(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT balance, ledger_balance FROM wallets WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ balance: number; ledger_balance: number }>();
  return {
    balance: Number(row?.balance ?? 0),
    ledger: Number(row?.ledger_balance ?? 0),
  };
}

function assertBatch(results: { success: boolean }[]) {
  if (results.some((row) => !row.success)) {
    throw new Error("Ledger batch failed");
  }
}

export async function settleMatchKobo(
  db: D1Database,
  match: Match,
  winnerId: string,
  reason: SettleReason,
) {
  if (match.player_b_id === CPU_ID) {
    const result = await db
      .prepare(
        `UPDATE matches
         SET status = 'completed', winner_id = ?, completed_at = datetime('now'),
             player_a_score = ?, player_b_score = ?, current_round = ?
         WHERE id = ?`,
      )
      .bind(
        winnerId,
        match.player_a_score,
        match.player_b_score,
        match.current_round,
        match.id,
      )
      .run();
    if (!result.success) throw new Error("CPU match close failed");
    return;
  }

  const sides: 1 | 2 =
    match.player_b_id && match.player_b_id !== CPU_ID ? 2 : 1;
  const {
    stakeKobo,
    totalPoolKobo,
    rakeKobo,
    payoutKobo,
    payoutAmount,
  } = rakeAndPayoutKobo(match.stake_amount, sides);

  const loserId =
    winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;
  const walletA = await walletSnapshot(db, match.player_a_id);
  const walletB = match.player_b_id
    ? await walletSnapshot(db, match.player_b_id)
    : null;
  const winnerSnap =
    winnerId === match.player_a_id ? walletA : walletB!;
  const winnerBalanceBeforeKobo = nairaToKobo(winnerSnap.balance);
  const winnerBalanceAfterKobo = winnerBalanceBeforeKobo + payoutKobo;

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE wallets
         SET ledger_balance = MAX(0, ledger_balance - ?),
             updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(match.stake_amount, match.player_a_id),
    txSql(db, {
      matchId: match.id,
      userId: match.player_a_id,
      kind: "stake_debit",
      amountKobo: stakeKobo,
      beforeKobo: nairaToKobo(walletA.ledger),
      afterKobo: Math.max(0, nairaToKobo(walletA.ledger) - stakeKobo),
    }),
  ];

  if (match.player_b_id && match.player_b_id !== CPU_ID && walletB) {
    statements.push(
      db
        .prepare(
          `UPDATE wallets
           SET ledger_balance = MAX(0, ledger_balance - ?),
               updated_at = datetime('now')
           WHERE user_id = ?`,
        )
        .bind(match.stake_amount, match.player_b_id),
      txSql(db, {
        matchId: match.id,
        userId: match.player_b_id,
        kind: "stake_debit",
        amountKobo: stakeKobo,
        beforeKobo: nairaToKobo(walletB.ledger),
        afterKobo: Math.max(0, nairaToKobo(walletB.ledger) - stakeKobo),
      }),
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE wallets
         SET balance = balance + ?, updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(payoutAmount, winnerId),
    txSql(db, {
      matchId: match.id,
      userId: winnerId,
      kind: "payout",
      amountKobo: payoutKobo,
      beforeKobo: winnerBalanceBeforeKobo,
      afterKobo: winnerBalanceAfterKobo,
    }),
    db
      .prepare(
        `UPDATE escrow_ledger
         SET status = 'released', released_at = datetime('now')
         WHERE match_id = ? AND status = 'held'`,
      )
      .bind(match.id),
    db
      .prepare(
        `UPDATE matches
         SET status = 'completed', winner_id = ?, completed_at = datetime('now'),
             player_a_score = ?, player_b_score = ?, current_round = ?
         WHERE id = ?`,
      )
      .bind(
        winnerId,
        match.player_a_score,
        match.player_b_score,
        match.current_round,
        match.id,
      ),
    db
      .prepare(
        `INSERT INTO match_history (
          id, match_id, winner_id, loser_id,
          stake_kobo, total_pool_kobo, rake_kobo, payout_kobo,
          player_a_score, player_b_score, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        match.id,
        winnerId,
        loserId,
        stakeKobo,
        totalPoolKobo,
        rakeKobo,
        payoutKobo,
        match.player_a_score,
        match.player_b_score,
        reason,
      ),
  );

  const results = await db.batch(statements);
  assertBatch(results);
}
