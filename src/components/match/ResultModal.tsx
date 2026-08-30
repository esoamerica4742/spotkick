"use client";

import { formatNaira } from "@/lib/format";
import { triggerHaptic, unlockAudio } from "@/lib/soundManager";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

export function ResultModal({
  open,
  won,
  payout,
  youScore,
  oppScore,
  rematchPending,
  rematchError,
  onLobby,
  onRematch,
}: {
  open: boolean;
  won: boolean;
  payout: number;
  youScore: number;
  oppScore: number;
  rematchPending?: boolean;
  rematchError?: string | null;
  onLobby: () => void;
  onRematch: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    triggerHaptic(won ? "success" : "heavy");
  }, [open, won]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/82 backdrop-blur-md" />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="result-title"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
            className="relative z-[2] overflow-hidden rounded-t-[1.75rem] border-t border-white/12 bg-oled px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/20" />

            <p className="text-center text-[10px] font-semibold tracking-[0.2em] text-white/40 uppercase">
              Full time
            </p>
            <p
              id="result-title"
              className={`mt-2 text-center font-display leading-none ${
                won
                  ? "text-[3.1rem] text-gold"
                  : "text-[3.1rem] text-silver"
              }`}
            >
              {won ? "You win" : "They win"}
            </p>
            <p className="mt-3 text-center font-display tabular text-[1.65rem] leading-none text-white">
              {youScore}–{oppScore}
            </p>

            {payout > 0 ? (
              <div className="mx-auto mt-5 max-w-[20rem] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-white/40 uppercase">
                  90% to the winner
                </p>
                <p
                  className={`mt-2 font-display tabular text-[1.55rem] leading-none ${
                    won ? "text-gold" : "text-white/55"
                  }`}
                >
                  {won ? formatNaira(payout) : "Stake released"}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-center text-[12px] font-semibold tracking-[0.14em] text-white/40 uppercase">
                Practice
              </p>
            )}

            {rematchError ? (
              <p className="mt-3 text-center text-xs font-semibold text-danger">
                {rematchError}
              </p>
            ) : null}

            <div className="mt-7 grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-2.5">
              <button
                type="button"
                onClick={() => {
                  unlockAudio();
                  triggerHaptic("light");
                  onLobby();
                }}
                className="flex min-h-[3.4rem] items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-[13px] font-semibold tracking-[0.06em] text-white uppercase"
              >
                Home
              </button>
              <button
                type="button"
                disabled={rematchPending}
                onClick={() => {
                  unlockAudio();
                  triggerHaptic("light");
                  onRematch();
                }}
                className="flex min-h-[3.4rem] items-center justify-center rounded-2xl bg-white text-[13px] font-semibold tracking-[0.04em] text-black uppercase disabled:opacity-50"
              >
                {rematchPending ? "Matching…" : payout > 0 ? "Rematch" : "Again"}
              </button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
