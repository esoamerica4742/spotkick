"use client";

import { KEEPER_REACT_MS } from "@/lib/constants";
import { fuseColor, fuseTone } from "@/lib/game/keeper-packet";

export function NeonFuse({
  remainMs,
  windowMs = KEEPER_REACT_MS,
}: {
  remainMs: number;
  windowMs?: number;
}) {
  const progress = Math.max(0, Math.min(1, remainMs / windowMs));
  const tone = fuseTone(remainMs);
  const color = fuseColor(tone);
  const seconds = (remainMs / 1000).toFixed(1);
  const circ = 2 * Math.PI * 16;

  return (
    <div className="mt-2 w-full" data-fuse={tone}>
      <div className="mb-1.5 flex items-center gap-2.5">
        <svg
          className="size-9 shrink-0 -rotate-90"
          viewBox="0 0 36 36"
          aria-hidden
        >
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2.4"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - progress)}
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <p
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color }}
            >
              React {seconds}
            </p>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">
              {(windowMs / 1000).toFixed(1).replace(/\.0$/, "")}s
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: color,
                boxShadow: `0 0 12px ${color}`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
