export const APP_NAME = "Spotkicka";
export const CPU_ID = "cpu-spotkick";
export const SESSION_COOKIE = "sk_session";

/** Night fill. Must match `--oled` in globals.css, PWA theme, and WebGL clear. */
export const OLED = "#07090f";
export const NEON = "#00FF66";

export const STAKE_TIERS = [500, 1_000, 5_000, 10_000] as const;
export type StakeTier = (typeof STAKE_TIERS)[number];

export const DEPOSIT_PRESETS = [1_000, 5_000, 10_000, 20_000] as const;

export const MIN_STAKE = 500;
export const MAX_STAKE = 50_000;
export const STAKE_STEP = 100;
export const MARKET_TTL_MS = 180_000;

export function isValidStake(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_STAKE &&
    value <= MAX_STAKE &&
    value % STAKE_STEP === 0
  );
}

export const REGULATION_KICKS = 6;
export const KICKS_PER_PLAYER = 3;
export const CHOICE_WINDOW_MS = 10_000;
/** Human keeper: read the plant, place, freeze on one peak. */
export const KEEPER_REACT_MS = 1_800;
/** Jade covers the grow-to-peak. Last 800ms is cyan — late, no second Perfect. */
export const KEEPER_JADE_MS = 1_000;
/** Server slack so RTT does not clip a fair 1.8s of visible run-up. */
export const KEEPER_SYNC_SLACK_MS = 400;
/** Practice CPU dive after you freeze — reads the plant, then covers. */
export const CPU_KEEPER_MS = 1_250;
export const PLAYBACK_MS = 3_800;
export const FLASH_BOUNTY_MS = 30_000;
export const RAKE_RATE = 0.1;

export function poolName(stake: number): string {
  return `pool-${stake}`;
}

export const ZONES = ["left", "center", "right"] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};
