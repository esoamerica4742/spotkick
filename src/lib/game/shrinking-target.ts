import { contactPull } from "@/lib/game/engine";

export const RING_START_SCALE = 3;
export const RING_END_SCALE = 0;
export const RING_BULLSEYE_SCALE = 0.22;
export const RING_PASS_MS = 1_000;

export type PrecisionGrade =
  | "PERFECT"
  | "GREAT"
  | "GOOD"
  | "FAIR"
  | "MISS";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapPass(elapsedMs: number): number {
  return ((elapsedMs % RING_PASS_MS) + RING_PASS_MS) % RING_PASS_MS;
}

/** Linear shrink from 3.0x to 0.0x over exactly one second. */
export function scaleAtElapsed(elapsedMs: number): number {
  const t = clamp(elapsedMs / RING_PASS_MS, 0, 1);
  return RING_START_SCALE * (1 - t);
}

/**
 * Same shrink, then snap back to 3.0 when the pass hits zero
 * so the next cycle starts large.
 */
export function scaleAtElapsedLooped(elapsedMs: number): number {
  return RING_START_SCALE * (1 - wrapPass(elapsedMs) / RING_PASS_MS);
}

/**
 * 100% when the shrinking ring sits on the bullseye boundary.
 * Early (ring too wide) and late (collapsed to 0) both fall to 0%.
 */
export function accuracyFromScale(scale: number): number {
  const peak = RING_BULLSEYE_SCALE;
  if (scale >= peak) {
    return clamp(
      100 * (1 - (scale - peak) / (RING_START_SCALE - peak)),
      0,
      100,
    );
  }
  return clamp((100 * (scale - RING_END_SCALE)) / peak, 0, 100);
}

/**
 * Keeper shield size on screen. Same timing curve as the kicker ring:
 * grows from a pinprick toward full at the bullseye, then collapses if late.
 * Scoring still uses accuracyFromScale — bigger is not a free save.
 */
export const COVER_VISUAL_MIN = 0.1;

export function coverVisualScale(ringScale: number): number {
  const acc = accuracyFromScale(ringScale) / 100;
  return COVER_VISUAL_MIN + acc * (1 - COVER_VISUAL_MIN);
}

export function precisionGrade(pct: number): PrecisionGrade {
  if (pct >= 95) return "PERFECT";
  if (pct >= 85) return "GREAT";
  if (pct >= 70) return "GOOD";
  if (pct >= 45) return "FAIR";
  return "MISS";
}

export function formatPrecision(
  role: "shooter" | "keeper",
  pct: number,
): string {
  if (role === "keeper") {
    return `DIVE REACH: ${Math.round(pct)}% ${precisionGrade(pct)}`;
  }
  const pull = Math.round(contactPull(pct) * 100);
  return `STRIKE ${Math.round(pct)}% ${precisionGrade(pct)} · pull ${pull}%`;
}
