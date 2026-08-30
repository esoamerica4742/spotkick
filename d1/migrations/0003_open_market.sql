-- Relax stake CHECK so open-market custom amounts are valid.
PRAGMA foreign_keys = OFF;

CREATE TABLE matches_v2 (
  id TEXT PRIMARY KEY,
  stake_amount INTEGER NOT NULL CHECK (stake_amount >= 500 AND stake_amount <= 50000),
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

INSERT INTO matches_v2 SELECT * FROM matches;
DROP TABLE matches;
ALTER TABLE matches_v2 RENAME TO matches;

CREATE INDEX IF NOT EXISTS matches_waiting_stake_idx
  ON matches (stake_amount, created_at)
  WHERE status = 'waiting' AND player_b_id IS NULL;

CREATE INDEX IF NOT EXISTS matches_live_a_idx ON matches(player_a_id, status);
CREATE INDEX IF NOT EXISTS matches_live_b_idx ON matches(player_b_id, status);
CREATE INDEX IF NOT EXISTS matches_waiting_created_idx
  ON matches (created_at)
  WHERE status = 'waiting' AND player_b_id IS NULL;

PRAGMA foreign_keys = ON;
