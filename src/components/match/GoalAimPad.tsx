"use client";

import { accuracyFromScale } from "@/lib/game/shrinking-target";
import { fuseTone } from "@/lib/game/keeper-packet";
import {
  GOAL_MILLI,
  actualShot,
  coverDisplayRadius,
  coverRadiusMilli,
  type AimPoint,
} from "@/lib/game/engine";
import { type TargetLock, type TargetPhase } from "@/hooks/useShrinkingTarget";
import { type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useState } from "react";

function padPct(aim: AimPoint) {
  return {
    left: `${((aim.x / GOAL_MILLI + 1) / 2) * 100}%`,
    top: `${(1 - aim.y / GOAL_MILLI) * 100}%`,
  };
}

export function GoalAimPad({
  role,
  aim,
  phase,
  lock,
  disabled,
  liveScale,
  react,
  remainMs,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  role: "shooter" | "keeper";
  aim: AimPoint | null;
  phase: TargetPhase;
  lock: TargetLock | null;
  disabled: boolean;
  liveScale: MutableRefObject<number>;
  react?: boolean;
  remainMs?: number;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (phase !== "shrinking") return;
    let id = 0;
    const loop = () => {
      setTick((n) => n + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const mark = lock?.aim ?? aim;
  const accuracy =
    lock?.accuracy ??
    (phase === "shrinking" ? Math.round(accuracyFromScale(liveScale.current)) : 0);
  const radius =
    phase === "locked"
      ? coverRadiusMilli(accuracy)
      : coverDisplayRadius(accuracy);
  const discW =
    role === "keeper" && phase !== "idle"
      ? (radius / GOAL_MILLI) * 100
      : 0;
  const placed = padPct(mark ?? { x: 0, y: 500 });
  const strike =
    role === "shooter" && mark ? actualShot(mark, accuracy) : null;
  const strikePct = strike ? padPct(strike) : null;
  const pulled =
    strike &&
    mark &&
    (strike.x !== mark.x || strike.y !== mark.y);
  const tone =
    role === "keeper" && remainMs != null ? fuseTone(remainMs) : null;

  return (
    <button
      type="button"
      className="sk-aim-mouth"
      data-react={react ? "true" : "false"}
      data-role={role}
      disabled={disabled}
      aria-label={role === "keeper" ? "Place dive" : "Place shot"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="sk-aim-bar" />
      <span className="sk-aim-post sk-aim-post-l" />
      <span className="sk-aim-post sk-aim-post-r" />
      {role === "keeper" && phase !== "idle" && mark ? (
        <span
          className="sk-aim-disc"
          data-tick={tick}
          data-fuse={tone ?? undefined}
          data-phase={phase}
          style={{
            left: placed.left,
            top: placed.top,
            width: `${discW}%`,
            height: `${discW * 2}%`,
          }}
        />
      ) : null}
      {phase !== "idle" && mark ? (
        <span className="sk-aim-spot" data-role={role} style={placed} />
      ) : null}
      {pulled && strikePct ? (
        <span className="sk-aim-actual" style={strikePct} />
      ) : null}
    </button>
  );
}
