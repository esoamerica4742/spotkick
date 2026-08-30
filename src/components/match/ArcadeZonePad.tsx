"use client";

import { CHOICE_WINDOW_MS, type Zone } from "@/lib/constants";
import { isReactWindow } from "@/lib/game/window";
import { triggerHaptic, unlockAudio } from "@/lib/soundManager";
import { useEffect, useRef } from "react";

const STRIKE: { zone: Zone; dir: string; verb: string }[] = [
  { zone: "left", dir: "LEFT", verb: "SHOOT" },
  { zone: "center", dir: "CENTER", verb: "BLAST" },
  { zone: "right", dir: "RIGHT", verb: "CURVE" },
];

const KEEP: { zone: Zone; dir: string; verb: "DIVE" | "HOLD" }[] = [
  { zone: "left", dir: "LEFT", verb: "DIVE" },
  { zone: "center", dir: "CENTER", verb: "HOLD" },
  { zone: "right", dir: "RIGHT", verb: "DIVE" },
];

const CLOCK_R = 15.2;
const CLOCK_CIRC = 2 * Math.PI * CLOCK_R;

function Glyph({ zone }: { zone: Zone }) {
  if (zone === "center") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="sk-pad-glyph">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="sk-pad-glyph">
      <path
        d={
          zone === "left"
            ? "M15.2 5.2 7.8 12l7.4 6.8"
            : "M8.8 5.2 16.2 12l-7.4 6.8"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function clockTone(remainMs: number, windowMs: number): "green" | "yellow" | "red" {
  const frac = remainMs / windowMs;
  if (frac > 0.4) return "green";
  if (frac > 0.2) return "yellow";
  return "red";
}

export function ArcadeZonePad({
  isGoalKeeper,
  selected,
  armed,
  disabled,
  closesAt,
  windowMs = CHOICE_WINDOW_MS,
  onSelect,
}: {
  isGoalKeeper: boolean;
  selected: Zone | null;
  armed?: boolean;
  disabled: boolean;
  closesAt?: string | null;
  windowMs?: number;
  onSelect: (zone: Zone) => void;
}) {
  const actions = isGoalKeeper ? KEEP : STRIKE;
  const kit = isGoalKeeper ? "keeper" : "shooter";
  const rings = useRef<(SVGCircleElement | null)[]>([null, null, null]);
  const clocks = useRef<(SVGSVGElement | null)[]>([null, null, null]);
  const lastBuzz = useRef(0);
  const lastTone = useRef<"green" | "yellow" | "red">("green");

  useEffect(() => {
    if (!closesAt) {
      for (const ring of rings.current) {
        if (ring) ring.style.strokeDashoffset = "0";
      }
      return;
    }

    let raf = 0;
    const closes = new Date(closesAt).getTime();

    const tick = (now: number) => {
      const remain = Math.max(0, closes - Date.now());
      const progress = Math.max(0, Math.min(1, remain / windowMs));
      const offset = CLOCK_CIRC * (1 - progress);
      const tone = clockTone(remain, windowMs);
      const react = isReactWindow(windowMs);

      for (let i = 0; i < 3; i += 1) {
        const ring = rings.current[i];
        const svg = clocks.current[i];
        if (ring) ring.style.strokeDashoffset = String(offset);
        if (svg && lastTone.current !== tone) {
          svg.dataset.tone = tone;
        }
      }
      lastTone.current = tone;

      const buzzEvery = react ? 160 : 380;
      const buzzUnder = react ? windowMs : 2_000;
      if (remain > 0 && remain <= buzzUnder && now - lastBuzz.current >= buzzEvery) {
        lastBuzz.current = now;
        triggerHaptic(react ? "heavy" : "light");
      }

      if (remain > 0) raf = requestAnimationFrame(tick);
    };

    lastBuzz.current = 0;
    lastTone.current = "green";
    for (const svg of clocks.current) {
      if (svg) svg.dataset.tone = "green";
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [closesAt, windowMs]);

  return (
    <div className="sk-pad" data-kit={kit}>
      <span className="sk-pad-screw sk-pad-screw-tl" aria-hidden />
      <span className="sk-pad-screw sk-pad-screw-tr" aria-hidden />
      <span className="sk-pad-screw sk-pad-screw-bl" aria-hidden />
      <span className="sk-pad-screw sk-pad-screw-br" aria-hidden />
      <div className="sk-pad-row">
        {actions.map((action, index) => {
          const active = selected === action.zone;
          return (
            <div key={action.zone} className="sk-pad-slot">
              <div className="sk-pad-well">
                <svg
                  ref={(el) => {
                    clocks.current[index] = el;
                  }}
                  className="sk-pad-clock"
                  viewBox="0 0 36 36"
                  data-tone="green"
                  aria-hidden
                >
                  <circle
                    cx="18"
                    cy="18"
                    r={CLOCK_R}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1.55"
                  />
                  <circle
                    ref={(el) => {
                      rings.current[index] = el;
                    }}
                    className="sk-pad-clock-arc"
                    cx="18"
                    cy="18"
                    r={CLOCK_R}
                    fill="none"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeDasharray={CLOCK_CIRC}
                    strokeDashoffset={0}
                  />
                </svg>
                <button
                  type="button"
                  disabled={disabled}
                  data-active={active ? "true" : "false"}
                  data-armed={active && armed ? "true" : "false"}
                  aria-label={`${action.dir} ${action.verb}`}
                  aria-pressed={active}
                  onPointerDown={(event) => {
                    if (disabled) return;
                    event.preventDefault();
                    unlockAudio();
                    onSelect(action.zone);
                  }}
                  className="sk-pad-btn"
                >
                  <Glyph zone={action.zone} />
                </button>
              </div>
              <span className="sk-pad-dir">{action.dir}</span>
              <span className="sk-pad-verb">{action.verb}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
