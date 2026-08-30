"use client";

import { KEEPER_REACT_MS } from "@/lib/constants";
import { playReact, triggerHaptic } from "@/lib/soundManager";
import { useLayoutEffect, useRef, useState } from "react";

export function useReactStopwatch({
  active,
  durationMs = KEEPER_REACT_MS,
  onExpire,
}: {
  active: boolean;
  durationMs?: number;
  onExpire?: () => void;
}) {
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const [sample, setNow] = useState(0);

  useLayoutEffect(() => {
    if (!active) {
      startRef.current = null;
      firedRef.current = false;
      return;
    }

    startRef.current = performance.now();
    firedRef.current = false;
    playReact();
    triggerHaptic("heavy");

    let raf = 0;
    const tick = () => {
      const start = startRef.current;
      if (start == null) return;
      const elapsed = performance.now() - start;
      setNow(elapsed);
      if (elapsed >= durationMs && !firedRef.current) {
        firedRef.current = true;
        expireRef.current?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, durationMs]);

  const start = startRef.current;
  const elapsed = start == null ? 0 : Math.max(0, sample);
  const remain = Math.max(0, durationMs - elapsed);
  const progress = Math.max(0, Math.min(1, remain / durationMs));

  return {
    elapsed,
    remain,
    progress,
    started: start != null,
  };
}
