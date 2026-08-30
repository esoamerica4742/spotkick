import {
  KEEPER_JADE_MS,
  KEEPER_REACT_MS,
} from "@/lib/constants";

export type KeeperPacket = {
  x: number;
  y: number;
  timeElapsed: number;
  executionScore: number;
};

export type FuseTone = "jade" | "cyan";

export function fuseTone(remainMs: number): FuseTone {
  return remainMs > KEEPER_REACT_MS - KEEPER_JADE_MS ? "jade" : "cyan";
}

export function fuseColor(tone: FuseTone): string {
  return tone === "jade" ? "#00FF66" : "#3EE7FF";
}

export function executionScoreForElapsed(
  timeElapsed: number,
  freezeScore: number,
  windowMs = KEEPER_REACT_MS,
): number {
  if (!Number.isFinite(timeElapsed) || timeElapsed > windowMs) return 0;
  if (timeElapsed < 0) return 0;
  return Math.max(0, Math.min(100, Math.round(freezeScore)));
}
