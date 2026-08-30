"use client";

import { useRef, useState } from "react";

const STEPS = [
  {
    kicker: "01",
    title: "Stake & choose kit",
    body: "Set a custom P2P stake, pick an Elite 5 kit, and post the challenge. Real opponents browse the open market and tap in.",
  },
  {
    kicker: "02",
    title: "10s timed lock",
    body: "Each kick is Left, Center, or Right. Ten seconds. Simultaneous lock. No peeking, no lag games.",
  },
  {
    kicker: "03",
    title: "Winner takes 90%",
    body: "Both stakes lock in escrow. Ten percent platform rake. Ninety percent pays the winner instantly.",
  },
] as const;

export function HeroStepper() {
  const [index, setIndex] = useState(0);
  const startX = useRef(0);

  function go(next: number) {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  return (
    <div className="select-none">
      <div
        className="touch-pan-y overflow-hidden"
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          const dx = event.clientX - startX.current;
          if (dx < -40) go(index + 1);
          if (dx > 40) go(index - 1);
        }}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {STEPS.map((step) => (
            <article key={step.kicker} className="flex-[0_0_100%] px-0.5">
              <div className="rounded-[1.25rem] border border-white/10 bg-black/40 px-4 py-4 backdrop-blur-md">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#00FF66] uppercase">
                  Step {step.kicker}
                </p>
                <h2 className="font-display mt-1.5 text-[1.65rem] leading-[0.92] text-silver">
                  {step.title}
                </h2>
                <p className="mt-2 max-w-[36ch] text-[13px] font-medium leading-relaxed text-silver/75">
                  {step.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {STEPS.map((step, i) => (
          <button
            key={step.kicker}
            type="button"
            aria-label={`Step ${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            onClick={() => go(i)}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-[#00FF66]" : "w-2 bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
