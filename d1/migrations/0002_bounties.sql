CREATE TABLE IF NOT EXISTS bounties (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id),
  stake_amount INTEGER NOT NULL CHECK (stake_amount IN (500, 1000, 5000, 10000)),
  team_id TEXT NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at TEXT,
  claimed_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS bounties_open_idx ON bounties (status, created_at)
  WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS bounties_open_match_idx
  ON bounties (match_id) WHERE status = 'open';
