"use client";

import { type AimPoint } from "@/lib/game/engine";
import { fuseColor, fuseTone } from "@/lib/game/keeper-packet";
import { type TargetLock, type TargetPhase } from "@/hooks/useShrinkingTarget";
import { goalWorldFromMilli } from "@/components/match/stadium/World";
import { Html } from "@react-three/drei";
import { type CSSProperties, type RefCallback } from "react";

export function ShrinkingTargetRing({
  role,
  aim,
  phase,
  shock,
  ringRef,
  remainMs,
}: {
  role: "shooter" | "keeper";
  zone?: string | null;
  aim: AimPoint | null;
  phase: TargetPhase;
  lock: TargetLock | null;
  shock: boolean;
  ringRef: RefCallback<SVGGElement>;
  remainMs?: number;
}) {
  if (phase === "idle" || !aim) return null;
  const pos = goalWorldFromMilli(aim.x, aim.y);
  const keeper = role === "keeper";
  const tone = remainMs != null ? fuseTone(remainMs) : "cyan";
  const glow = keeper ? fuseColor(tone) : "#e8c547";

  return (
    <Html
      position={[pos.x, pos.y, pos.z]}
      center
      sprite
      distanceFactor={keeper ? 8.4 : 7.2}
      zIndexRange={[18, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="sk-target-html"
        data-kind={keeper ? "cover" : "strike"}
        data-fuse={keeper ? tone : undefined}
      >
        {keeper ? (
          <svg className="sk-target-svg" viewBox="0 0 100 100" aria-hidden>
            <g ref={ringRef} className="sk-target-ring sk-cover-ring">
              <ellipse
                cx="50"
                cy="50"
                rx="38"
                ry="38"
                fill={`${glow}22`}
                stroke={glow}
                strokeWidth="1.6"
              />
              <ellipse
                cx="50"
                cy="50"
                rx="38"
                ry="38"
                fill="none"
                stroke={`${glow}55`}
                strokeWidth="5.5"
              />
              <circle cx="50" cy="50" r="2.1" fill={glow} />
            </g>
          </svg>
        ) : (
          <svg className="sk-target-svg" viewBox="0 0 100 100" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="7.2"
              fill="none"
              stroke="rgba(232, 197, 71, 0.95)"
              strokeWidth="1.35"
            />
            <circle cx="50" cy="50" r="1.55" fill="#e8c547" />
            <line
              x1="50"
              y1="38"
              x2="50"
              y2="44"
              stroke="rgba(232, 197, 71, 0.7)"
              strokeWidth="1.1"
            />
            <line
              x1="50"
              y1="56"
              x2="50"
              y2="62"
              stroke="rgba(232, 197, 71, 0.7)"
              strokeWidth="1.1"
            />
            <line
              x1="38"
              y1="50"
              x2="44"
              y2="50"
              stroke="rgba(232, 197, 71, 0.7)"
              strokeWidth="1.1"
            />
            <line
              x1="56"
              y1="50"
              x2="62"
              y2="50"
              stroke="rgba(232, 197, 71, 0.7)"
              strokeWidth="1.1"
            />
            <g ref={ringRef} className="sk-target-ring">
              <circle
                cx="50"
                cy="50"
                r="16"
                fill="none"
                stroke="#e8c547"
                strokeWidth="1.7"
              />
              <circle
                cx="50"
                cy="50"
                r="16"
                fill="none"
                stroke="rgba(232, 197, 71, 0.28)"
                strokeWidth="4.2"
              />
            </g>
          </svg>
        )}
        {shock ? (
          <span className="sk-target-shock" data-role={role} aria-hidden>
            <span />
            <span />
            <span />
            {Array.from({ length: 8 }, (_, i) => (
              <i
                key={i}
                className="sk-target-spark"
                style={
                  {
                    "--spark-rot": `${i * 45}deg`,
                    animationDelay: `${i * 18}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
      </div>
    </Html>
  );
}
