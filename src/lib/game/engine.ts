import {
  KICKS_PER_PLAYER,
  REGULATION_KICKS,
  type Zone,
} from "../constants";
import type { RoundOutcome } from "./types";

/** 1 naira = 100 kobo. All rake math is integer kobo. */
export const KOBO_PER_NAIRA = 100;

/** Complete mechanical whiff: kicker accuracy below this is a SAVE. */
export const WHIFF_ACCURACY = 15;

export type KickFinish = "goal" | "save" | "wide";

export type KickWhy =
  | "goal"
  | "save"
  | "open-net"
  | "whiff"
  | "wide"
  | "no-strike";

export function nairaToKobo(naira: number): number {
  return Math.trunc(naira) * KOBO_PER_NAIRA;
}

export function koboToNaira(kobo: number): number {
  return Math.trunc(kobo / KOBO_PER_NAIRA);
}

export function clampAccuracy(value: unknown, fallback = 100): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export type KickResolution = {
  outcome: Exclude<RoundOutcome, "pending">;
  finish: KickFinish;
  why: KickWhy;
  intended: AimPoint | null;
  actual: AimPoint | null;
};

export const GOAL_MILLI = 1000;
export const COVER_RADIUS_MIN = 180;
export const COVER_RADIUS_MAX = 420;

export type AimPoint = { x: number; y: number };

export function clampMilliX(x: number): number {
  return Math.max(-GOAL_MILLI, Math.min(GOAL_MILLI, Math.round(x)));
}

export function clampMilliY(y: number): number {
  return Math.max(0, Math.min(GOAL_MILLI, Math.round(y)));
}

export function padToMilli(nx: number, ny: number): AimPoint {
  return {
    x: clampMilliX((nx * 2 - 1) * GOAL_MILLI),
    y: clampMilliY((1 - ny) * GOAL_MILLI),
  };
}

export function zoneFromMilliX(x: number): Zone {
  if (x < -334) return "left";
  if (x > 334) return "right";
  return "center";
}

export function milliFromZone(zone: Zone): AimPoint {
  if (zone === "left") return { x: -660, y: 620 };
  if (zone === "right") return { x: 660, y: 620 };
  return { x: 0, y: 480 };
}

export function coverRadiusMilli(accuracy: number): number {
  const a = clampAccuracy(accuracy, 0);
  return COVER_RADIUS_MIN + ((COVER_RADIUS_MAX - COVER_RADIUS_MIN) * a) / 100;
}

/** Live pad disc: starts tiny, stretches toward max as the freeze peak nears. */
export function coverDisplayRadius(accuracy: number): number {
  const a = clampAccuracy(accuracy, 0);
  const tiny = COVER_RADIUS_MIN * 0.16;
  return tiny + ((COVER_RADIUS_MAX - tiny) * a) / 100;
}

/**
 * Coarse body-read for the keeper. Three lanes × three heights.
 * Exact millipoints stay on the kicker; covering this stamp does not
 * cover the real strike.
 */
export function telegraphAim(aim: AimPoint): AimPoint {
  const x = Math.abs(aim.x) < 280 ? 0 : aim.x < 0 ? -720 : 720;
  const y = aim.y < 380 ? 220 : aim.y < 680 ? 580 : 860;
  return { x, y };
}

/** What a keeper can actually see: the pulled strike, not the postage stamp. */
export function bodyRead(aim: AimPoint, kickerAccuracy = 100): AimPoint {
  return telegraphAim(actualShot(aim, kickerAccuracy));
}

export function runupForViewer(
  live: {
    outcome: string;
    shooter_id: string;
    shooter_x: number | null;
    shooter_y: number | null;
    shooter_accuracy?: number | null;
  } | null,
  userId: string,
): AimPoint | null {
  if (
    !live ||
    live.outcome !== "pending" ||
    live.shooter_x == null ||
    live.shooter_y == null
  ) {
    return null;
  }
  const aim = { x: live.shooter_x, y: live.shooter_y };
  if (live.shooter_id === userId) return aim;
  return bodyRead(aim, live.shooter_accuracy ?? 100);
}

/** Low-center plant. Poor freeze pulls the strike here. Deterministic. */
export const PLANT_MILLI: AimPoint = { x: 0, y: 320 };

/**
 * 100% freeze = 0 pull (you hit the point). 50% ≈ 55% toward plant.
 * No RNG. Corners demand a real freeze.
 */
export function contactPull(accuracy: number): number {
  const a = clampAccuracy(accuracy, 0);
  if (a >= 100) return 0;
  return Math.pow((100 - a) / 100, 0.85);
}

export function actualShot(aim: AimPoint, accuracy: number): AimPoint {
  const pull = contactPull(accuracy);
  return {
    x: clampMilliX(Math.round(aim.x + (PLANT_MILLI.x - aim.x) * pull)),
    y: clampMilliY(Math.round(aim.y + (PLANT_MILLI.y - aim.y) * pull)),
  };
}

export function whyCopy(why: KickWhy): string {
  if (why === "goal") return "Past the dive";
  if (why === "save") return "Inside the gloves";
  if (why === "open-net") return "Open net";
  if (why === "whiff") return "Heavy miss — no strike";
  if (why === "wide") return "Pulled wide of the frame";
  return "No strike";
}

export function isOnTarget(x: number, y: number): boolean {
  return x >= -GOAL_MILLI && x <= GOAL_MILLI && y >= 0 && y <= GOAL_MILLI;
}

function emptyKick(why: KickWhy): KickResolution {
  return {
    outcome: "saved",
    finish: "wide",
    why,
    intended: null,
    actual: null,
  };
}

/**
 * Intent vs cover disc. The strike is pulled toward plant by freeze.
 * No RNG. Kicker freeze < 15 is a whiff. Better keeper freeze = larger reach.
 */
export function resolveAim(
  shot: AimPoint | null,
  cover: { x: number; y: number } | null,
  kickerAccuracy = 100,
  keeperAccuracy = 100,
): KickResolution {
  if (!shot) return emptyKick("no-strike");
  const kickAcc = clampAccuracy(kickerAccuracy, 0);
  if (kickAcc < WHIFF_ACCURACY) {
    return {
      outcome: "saved",
      finish: "wide",
      why: "whiff",
      intended: shot,
      actual: null,
    };
  }
  const actual = actualShot(shot, kickAcc);
  if (!isOnTarget(actual.x, actual.y)) {
    return {
      outcome: "saved",
      finish: "wide",
      why: "wide",
      intended: shot,
      actual,
    };
  }
  if (!cover) {
    return {
      outcome: "goal",
      finish: "goal",
      why: "open-net",
      intended: shot,
      actual,
    };
  }
  const radius = coverRadiusMilli(keeperAccuracy);
  const dx = actual.x - cover.x;
  const dy = actual.y - cover.y;
  if (dx * dx + dy * dy <= radius * radius) {
    return {
      outcome: "saved",
      finish: "save",
      why: "save",
      intended: shot,
      actual,
    };
  }
  return {
    outcome: "goal",
    finish: "goal",
    why: "goal",
    intended: shot,
    actual,
  };
}

export function resolveKick(
  kickerDir: Zone | null,
  keeperDir: Zone | null,
  kickerAccuracy = 100,
  keeperAccuracy = 100,
): KickResolution {
  return resolveAim(
    kickerDir ? milliFromZone(kickerDir) : null,
    keeperDir ? milliFromZone(keeperDir) : null,
    kickerAccuracy,
    keeperAccuracy,
  );
}

export function shooterForKick(
  kickNumber: number,
  playerAId: string,
  playerBId: string,
): { shooterId: string; keeperId: string } {
  const aShoots = kickNumber % 2 === 1;
  return aShoots
    ? { shooterId: playerAId, keeperId: playerBId }
    : { shooterId: playerBId, keeperId: playerAId };
}

/**
 * 3 kicks each (6 regulation). Early win when the trailer
 * cannot catch up. Sudden death after a 3-3 tie, decided
 * in pairs once both have taken the same number of extras.
 */
export function matchWinner(
  scoreA: number,
  scoreB: number,
  kicksDone: number,
): "a" | "b" | null {
  if (kicksDone < REGULATION_KICKS) {
    const shotsADone = Math.ceil(kicksDone / 2);
    const shotsBDone = Math.floor(kicksDone / 2);
    const remainA = KICKS_PER_PLAYER - shotsADone;
    const remainB = KICKS_PER_PLAYER - shotsBDone;
    if (scoreA > scoreB + remainB) return "a";
    if (scoreB > scoreA + remainA) return "b";
    return null;
  }

  if (kicksDone === REGULATION_KICKS) {
    if (scoreA === scoreB) return null;
    return scoreA > scoreB ? "a" : "b";
  }

  const extra = kicksDone - REGULATION_KICKS;
  if (extra % 2 === 0 && scoreA !== scoreB) {
    return scoreA > scoreB ? "a" : "b";
  }
  return null;
}

export function rakeAndPayoutKobo(
  stakeNaira: number,
  sides: 1 | 2 = 2,
): {
  stakeKobo: number;
  totalPoolKobo: number;
  rakeKobo: number;
  payoutKobo: number;
  totalPool: number;
  platformRake: number;
  payoutAmount: number;
} {
  const stakeKobo = nairaToKobo(stakeNaira);
  const totalPoolKobo = stakeKobo * sides;
  // Integer form of totalPoolKobo * 0.10 — no float rake.
  const rakeKobo = (totalPoolKobo * 10) / 100;
  const payoutKobo = totalPoolKobo - rakeKobo;
  return {
    stakeKobo,
    totalPoolKobo,
    rakeKobo,
    payoutKobo,
    totalPool: koboToNaira(totalPoolKobo),
    platformRake: koboToNaira(rakeKobo),
    payoutAmount: koboToNaira(payoutKobo),
  };
}

export function rakeAndPayout(
  stake: number,
  sides: 1 | 2 = 2,
): {
  totalPool: number;
  platformRake: number;
  payoutAmount: number;
} {
  const kobo = rakeAndPayoutKobo(stake, sides);
  return {
    totalPool: kobo.totalPool,
    platformRake: kobo.platformRake,
    payoutAmount: kobo.payoutAmount,
  };
}

export type CpuStrike = { aim: AimPoint; accuracy: number };

/** CPU kicker with a plan — corners, under the bar, or a planted bait. */
export function cpuStrikePlan(): CpuStrike {
  const roll = Math.random();
  if (roll < 0.18) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (860 + Math.floor(Math.random() * 120));
    const y = 640 + Math.floor(Math.random() * 220);
    return {
      aim: { x: clampMilliX(x), y: clampMilliY(y) },
      accuracy: 26 + Math.floor(Math.random() * 18),
    };
  }
  let x: number;
  let y: number;
  if (roll < 0.52) {
    x = (Math.random() < 0.5 ? -1 : 1) * (780 + Math.floor(Math.random() * 180));
    y = 700 + Math.floor(Math.random() * 240);
  } else if (roll < 0.78) {
    x = (Math.random() < 0.5 ? -1 : 1) * (500 + Math.floor(Math.random() * 240));
    y = 360 + Math.floor(Math.random() * 280);
  } else {
    x = -140 + Math.floor(Math.random() * 280);
    y = 180 + Math.floor(Math.random() * 300);
  }
  return {
    aim: { x: clampMilliX(x), y: clampMilliY(y) },
    accuracy: 66 + Math.floor(Math.random() * 30),
  };
}

export function randomCpuShot(): AimPoint {
  return cpuStrikePlan().aim;
}

export function randomCpuCover(): AimPoint {
  return {
    x: -280 + Math.floor(Math.random() * 560),
    y: 260 + Math.floor(Math.random() * 420),
  };
}

/**
 * CPU dives to the pulled body-read, not the millipoint and not a random box.
 * Better freeze sits on the plant. Sloppy freeze misses height or the wing.
 */
export function cpuReadCover(
  shot: AimPoint,
  accuracy: number,
  kickerAccuracy = 100,
): AimPoint {
  const read = bodyRead(shot, kickerAccuracy);
  const skill = clampAccuracy(accuracy, 0);
  const slack = (100 - skill) / 100;
  const commit = skill >= 82 ? 0.16 : skill >= 64 ? 0.38 : 0.68;
  const wrongWing = skill < 68 && Math.random() < 0.12;
  const x = wrongWing ? -read.x : read.x;
  const missX = Math.round((Math.random() * 2 - 1) * (36 + 250 * slack));
  const missY = Math.round((Math.random() * 2 - 1) * (28 + 190 * slack));
  return {
    x: clampMilliX(Math.round(x + missX * commit)),
    y: clampMilliY(Math.round(read.y + missY * commit)),
  };
}

export function randomCpuAccuracy(): number {
  return 66 + Math.floor(Math.random() * 28);
}

/** True when the last three window-offsets are identical to the millisecond. */
export function isRoboticTiming(offsets: number[]): boolean {
  if (offsets.length < 3) return false;
  const a = offsets[offsets.length - 3]!;
  const b = offsets[offsets.length - 2]!;
  const c = offsets[offsets.length - 1]!;
  return a === b && b === c;
}

/** True when client timestamps share the same fractional millisecond 3 times. */
export function isRoboticFractionalTs(fracs: number[]): boolean {
  if (fracs.length < 3) return false;
  const a = fracs[fracs.length - 3]!;
  const b = fracs[fracs.length - 2]!;
  const c = fracs[fracs.length - 1]!;
  return a === b && b === c;
}

export function fractionalMs(ts: number): number {
  return Math.round((ts % 1) * 1e6);
}
