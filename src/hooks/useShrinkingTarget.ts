"use client";

import {
  RING_START_SCALE,
  accuracyFromScale,
  coverVisualScale,
  precisionGrade,
  scaleAtElapsedLooped,
  type PrecisionGrade,
} from "@/lib/game/shrinking-target";
import {
  padToMilli,
  type AimPoint,
} from "@/lib/game/engine";
import { playLock, triggerHaptic } from "@/lib/soundManager";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
} from "react";

export type TargetPhase = "idle" | "shrinking" | "locked";

export type TargetLock = {
  aim: AimPoint;
  accuracy: number;
  grade: PrecisionGrade;
};

export function useShrinkingTarget({
  enabled,
  mode = "shrink",
  onLock,
}: {
  enabled: boolean;
  mode?: "shrink" | "stretch";
  onLock: (aim: AimPoint, accuracy: number) => void;
}) {
  const [aim, setAim] = useState<AimPoint | null>(null);
  const [phase, setPhase] = useState<TargetPhase>("idle");
  const [lock, setLock] = useState<TargetLock | null>(null);
  const [shock, setShock] = useState(false);

  const ringRef = useRef<SVGGElement | null>(null);
  const phaseRef = useRef<TargetPhase>("idle");
  const aimRef = useRef<AimPoint | null>(null);
  const scaleRef = useRef(RING_START_SCALE);
  const startRef = useRef(0);
  const armedRef = useRef(false);
  const downAtRef = useRef(0);
  const tapArmedRef = useRef(false);
  const rafRef = useRef(0);
  const lockRef = useRef(onLock);
  const modeRef = useRef(mode);

  phaseRef.current = phase;
  aimRef.current = aim;
  lockRef.current = onLock;
  modeRef.current = mode;

  const visualFor = useCallback((scale: number) => {
    return modeRef.current === "stretch" ? coverVisualScale(scale) : scale;
  }, []);

  const applyScale = useCallback((scale: number) => {
    scaleRef.current = scale;
    const el = ringRef.current;
    if (!el) return;
    const visual = visualFor(scale);
    el.style.setProperty("--sk-ring-scale", String(visual));
    el.style.transform = `scale(${visual})`;
  }, [visualFor]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    armedRef.current = false;
  }, []);

  const bindRing: RefCallback<SVGGElement> = useCallback((node) => {
    ringRef.current = node;
    if (!node) return;
    const visual = visualFor(scaleRef.current);
    node.style.setProperty("--sk-ring-scale", String(visual));
    node.style.transform = `scale(${visual})`;
  }, [visualFor]);

  const reset = useCallback(() => {
    stopLoop();
    phaseRef.current = "idle";
    aimRef.current = null;
    applyScale(RING_START_SCALE);
    setAim(null);
    setPhase("idle");
    setLock(null);
    setShock(false);
  }, [applyScale, stopLoop]);

  const startPass = useCallback(
    (next: AimPoint) => {
      stopLoop();
      applyScale(RING_START_SCALE);
      phaseRef.current = "shrinking";
      aimRef.current = next;
      tapArmedRef.current = false;
      setLock(null);
      setShock(false);
      setAim(next);
      setPhase("shrinking");
      triggerHaptic("light");
    },
    [applyScale, stopLoop],
  );

  const freeze = useCallback(() => {
    if (phaseRef.current !== "shrinking" || !aimRef.current) return;
    stopLoop();
    const accuracy = Math.round(accuracyFromScale(scaleRef.current));
    const grade = precisionGrade(accuracy);
    const locked = aimRef.current;
    phaseRef.current = "locked";
    setPhase("locked");
    setLock({ aim: locked, accuracy, grade });
    if (accuracy >= 95) {
      setShock(true);
      triggerHaptic("success");
    } else {
      triggerHaptic("heavy");
    }
    playLock(accuracy);
    lockRef.current(locked, accuracy);
  }, [stopLoop]);

  useLayoutEffect(() => {
    if (phase !== "shrinking" || !aim) return;
    let cancelled = false;
    applyScale(RING_START_SCALE);

    const tick = (now: number) => {
      if (cancelled) return;
      const el = ringRef.current;
      if (!el || !armedRef.current) {
        applyScale(RING_START_SCALE);
        if (el) {
          armedRef.current = true;
          startRef.current = now;
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      applyScale(scaleAtElapsedLooped(now - startRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      stopLoop();
    };
  }, [aim, applyScale, phase, stopLoop]);

  const pointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLElement>): AimPoint | null => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return null;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = (event.clientY - rect.top) / rect.height;
      return padToMilli(nx, ny);
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (phaseRef.current === "locked") return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic / recycled pointer ids cannot capture */
      }
      const next = pointFromEvent(event);
      if (!next) return;
      downAtRef.current = performance.now();
      if (phaseRef.current === "idle") startPass(next);
      else {
        aimRef.current = next;
        setAim(next);
      }
    },
    [enabled, pointFromEvent, startPass],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || phaseRef.current !== "shrinking") return;
      const next = pointFromEvent(event);
      if (!next) return;
      aimRef.current = next;
      setAim(next);
    },
    [enabled, pointFromEvent],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (phaseRef.current !== "shrinking") return;
      const held = performance.now() - downAtRef.current;
      if (held >= 90 || tapArmedRef.current) {
        freeze();
        return;
      }
      tapArmedRef.current = true;
    },
    [enabled, freeze],
  );

  useEffect(() => {
    if (!enabled && phaseRef.current !== "locked") reset();
  }, [enabled, reset]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  return {
    ringRef: bindRing,
    aim,
    phase,
    lock,
    shock,
    liveScale: scaleRef,
    tap: freeze,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}