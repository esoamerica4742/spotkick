"use client";

import { CHOICE_WINDOW_MS } from "@/lib/constants";
import { playTick, triggerHaptic } from "@/lib/soundManager";
import { motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";

function remainMs(closesAt: string, now: number) {
  return Math.max(0, new Date(closesAt).getTime() - now);
}

const BOX = 64;
const CX = 32;
const R = 23.6;
const STROKE = 3.7;
const CIRC = 2 * Math.PI * R;

type ClockTone = "gold" | "warn" | "final";

function toneFor(remain: number): ClockTone {
  if (remain <= 1_050) return "final";
  if (remain <= 3_000) return "warn";
  return "gold";
}

function clockColor(tone: ClockTone) {
  if (tone === "final") return "#ff3b5c";
  if (tone === "warn") return "#ffb020";
  return "#e8c547";
}

function tickMarks() {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const major = i % 5 === 0;
    const inner = R - (major ? 6.6 : 5);
    const outer = R - 2.15;
    return {
      i,
      major,
      x1: CX + Math.cos(a) * inner,
      y1: CX + Math.sin(a) * inner,
      x2: CX + Math.cos(a) * outer,
      y2: CX + Math.sin(a) * outer,
    };
  });
}

export function CountdownTimer({
  closesAt,
  onExpire,
  windowMs = CHOICE_WINDOW_MS,
}: {
  closesAt: string;
  onExpire: () => void;
  windowMs?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const lastBeat = useRef<number | null>(null);
  const remain = remainMs(closesAt, now);
  const progress = Math.max(0, Math.min(1, remain / windowMs));
  const seconds = Math.max(0, Math.ceil(remain / 1000));
  const tone = toneFor(remain);
  const color = clockColor(tone);
  const glowId = useId().replace(/:/g, "");
  const ticks = useMemo(tickMarks, []);
  const head = progress > 0.015;
  const theta = progress * Math.PI * 2;
  const hx = CX + Math.cos(theta) * R;
  const hy = CX + Math.sin(theta) * R;

  useEffect(() => {
    fired.current = false;
    lastBeat.current = null;
    let raf = 0;
    const tick = () => {
      const next = Date.now();
      setNow(next);
      if (remainMs(closesAt, next) <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [closesAt, onExpire]);

  useEffect(() => {
    if (remain <= 0 || seconds > 3) return;
    if (lastBeat.current === seconds) return;
    lastBeat.current = seconds;
    playTick(seconds <= 1 ? "final" : "mid");
    triggerHaptic(seconds <= 1 ? "heavy" : "light");
  }, [remain, seconds]);

  return (
    <motion.div
      role="timer"
      aria-live="off"
      aria-label={`${seconds} seconds to place the shot`}
      initial={{ scale: 0.86, opacity: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="shrink-0"
    >
      <div
        className="sk-shot-clock"
        data-urgent={tone === "gold" ? undefined : tone}
        style={{ ["--clock" as string]: color }}
      >
        <svg
          className="absolute inset-[0.22rem] size-[calc(100%-0.44rem)] -rotate-90"
          viewBox={`0 0 ${BOX} ${BOX}`}
          aria-hidden
        >
        <defs>
          <filter
            id={glowId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="1.7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={CX} cy={CX} r={R + 1.1} fill="rgba(0,0,0,0.55)" />
        <circle
          cx={CX}
          cy={CX}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={STROKE}
        />
        {ticks.map((tick) => (
          <line
            key={tick.i}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={color}
            strokeWidth={tick.major ? 1.45 : 0.95}
            strokeLinecap="round"
            opacity={tick.major ? 0.72 : 0.32}
          />
        ))}
        <circle
          cx={CX}
          cy={CX}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={(1 - progress) * CIRC}
          filter={`url(#${glowId})`}
        />
        {head ? (
          <circle
            cx={hx}
            cy={hy}
            r={2.8}
            fill={color}
            filter={`url(#${glowId})`}
          />
        ) : null}
      </svg>
      <motion.span
        key={seconds}
        initial={{ scale: 1.18, opacity: 0.35 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 28 }}
        className="font-display tabular relative leading-none"
        style={{
          fontSize: seconds >= 10 ? "1.28rem" : "1.55rem",
          color,
          textShadow: `0 0 14px ${color}`,
        }}
      >
        {seconds}
      </motion.span>
      </div>
    </motion.div>
  );
}
