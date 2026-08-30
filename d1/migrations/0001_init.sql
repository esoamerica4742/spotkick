CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  team_id TEXT NOT NULL DEFAULT 'arsenal',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otp_challenges (
  phone_number TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  ledger_balance INTEGER NOT NULL DEFAULT 0 CHECK (ledger_balance >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  stake_amount INTEGER NOT NULL CHECK (stake_amount IN (500, 1000, 5000, 10000)),
  player_a_id TEXT NOT NULL REFERENCES users(id),
  player_b_id TEXT REFERENCES users(id),
  player_a_team TEXT NOT NULL DEFAULT 'arsenal',
  player_b_team TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
  winner_id TEXT REFERENCES users(id),
  player_a_score INTEGER NOT NULL DEFAULT 0,
  player_b_score INTEGER NOT NULL DEFAULT 0,
  current_round INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS matches_waiting_stake_idx
  ON matches (stake_amount, created_at)
  WHERE status = 'waiting' AND player_b_id IS NULL;

CREATE INDEX IF NOT EXISTS matches_live_a_idx ON matches(player_a_id, status);
CREATE INDEX IF NOT EXISTS matches_live_b_idx ON matches(player_b_id, status);

CREATE TABLE IF NOT EXISTS rounds (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  shooter_id TEXT NOT NULL,
  keeper_id TEXT NOT NULL,
  shooter_choice TEXT,
  keeper_choice TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('goal', 'saved', 'pending')),
  choice_opens_at TEXT NOT NULL,
  choice_closes_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (match_id, round_number)
);

INSERT OR IGNORE INTO users (id, phone_number, full_name, team_id)
VALUES ('cpu-spotkick', NULL, 'Lagos Keeper', 'chelsea');

INSERT OR IGNORE INTO wallets (user_id, balance, ledger_balance)
VALUES ('cpu-spotkick', 0, 0);

CREATE TABLE IF NOT EXISTS escrow_ledger (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  total_pool INTEGER NOT NULL,
  platform_rake INTEGER NOT NULL,
  payout_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  released_at TEXT
);
