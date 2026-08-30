"use client";

import { AnimatePresence, motion } from "framer-motion";

export function OutcomeFlash({
  value,
  role = "shooter",
  reason,
}: {
  value: "goal" | "saved" | null;
  role?: "shooter" | "keeper";
  reason?: string | null;
}) {
  const goal = value === "goal";
  const title = goal ? "GOAL" : "NO GOAL";
  const kicker = reason
    ? reason
    : goal
      ? role === "keeper"
        ? "Conceded"
        : "Past the dive"
      : role === "keeper"
        ? "Inside the gloves"
        : "Inside the gloves";

  return (
    <AnimatePresence>
      {value ? (
        <motion.div
          key={value}
          role="status"
          aria-live="assertive"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.28 } }}
          className="pointer-events-none fixed inset-0 z-50"
        >
          <motion.div
            aria-hidden
            className={`absolute inset-0 ${
              goal ? "bg-oled/35" : "bg-oled/55"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          <motion.div
            aria-hidden
            className={`absolute inset-x-0 top-0 h-[min(18vh,7.5rem)] ${
              goal
                ? "bg-gradient-to-b from-black via-black/80 to-transparent"
                : "bg-gradient-to-b from-black via-black/88 to-transparent"
            }`}
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[min(22vh,9rem)] bg-gradient-to-t from-black via-black/85 to-transparent"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          />

          <div
            aria-hidden
            className={`absolute inset-x-4 top-[max(0.85rem,env(safe-area-inset-top))] h-px ${
              goal ? "sk-sting-line-gold" : "sk-sting-line-ice"
            }`}
          />
          <div
            aria-hidden
            className={`absolute inset-x-4 bottom-[max(0.85rem,env(safe-area-inset-bottom))] h-px ${
              goal ? "sk-sting-line-gold" : "sk-sting-line-ice"
            }`}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
            <motion.p
              initial={{ opacity: 0, scale: 1.12, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className={`font-display text-center leading-[0.82] ${
                goal
                  ? "text-[clamp(5.2rem,22vw,8.2rem)] text-gold"
                  : "text-[clamp(3.4rem,14vw,5.6rem)] text-silver"
              }`}
              style={{
                textShadow: goal
                  ? "0 0 42px rgba(232,197,71,0.35), 0 12px 28px rgba(0,0,0,0.65)"
                  : "0 0 36px rgba(90,168,255,0.22), 0 12px 28px rgba(0,0,0,0.7)",
              }}
            >
              {title}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.32 }}
              className="type-kicker mt-4 text-white/70"
            >
              {kicker}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
