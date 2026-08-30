-- Accuracy columns for the sequential duel engine.
ALTER TABLE rounds ADD COLUMN shooter_accuracy INTEGER;
ALTER TABLE rounds ADD COLUMN keeper_accuracy INTEGER;

-- Double-entry kobo logs. Wallet spendable balances stay in naira (1 naira = 100 kobo).
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('stake_debit', 'payout', 'refund')),
  amount_kobo INTEGER NOT NULL,
  balance_before_kobo INTEGER NOT NULL,
  balance_after_kobo INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wallet_transactions_match_idx
  ON wallet_transactions (match_id, created_at);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx
  ON wallet_transactions (user_id, created_at);

CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  winner_id TEXT REFERENCES users(id),
  loser_id TEXT,
  stake_kobo INTEGER NOT NULL,
  total_pool_kobo INTEGER NOT NULL,
  rake_kobo INTEGER NOT NULL,
  payout_kobo INTEGER NOT NULL,
  player_a_score INTEGER NOT NULL,
  player_b_score INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('regulation', 'sudden_death', 'forfeit', 'timeout')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
