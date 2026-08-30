-- Aim-point vs cover disc. Millipoints: x -1000..1000, y 0..1000.
ALTER TABLE rounds ADD COLUMN shooter_x INTEGER;
ALTER TABLE rounds ADD COLUMN shooter_y INTEGER;
ALTER TABLE rounds ADD COLUMN keeper_x INTEGER;
ALTER TABLE rounds ADD COLUMN keeper_y INTEGER;
