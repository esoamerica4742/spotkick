"use client";

import { DEPOSIT_PRESETS } from "@/lib/constants";
import { formatNaira } from "@/lib/format";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import { X } from "lucide-react";
import { useState } from "react";

export function DepositSheet({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/72 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[1.55rem] border border-white/10 bg-[#0b0d14] px-4 pb-5 pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
              Wallet
            </p>
            <h2 className="mt-1 text-[1.45rem] font-semibold leading-none tracking-[-0.04em] text-white">
              Add Naira
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06]"
          >
            <X className="size-4 text-white/70" />
          </button>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-white/50">
          Adds to available Naira. Escrow only locks when you post or join a
          match.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {DEPOSIT_PRESETS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={pending !== null}
              onClick={async () => {
                setError(null);
                setPending(amount);
                try {
                  await onConfirm(amount);
                  onClose();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Deposit failed",
                  );
                } finally {
                  setPending(null);
                }
              }}
              className="flex h-16 items-center justify-center rounded-2xl bg-white/[0.04] font-display tabular text-[1.45rem] leading-none text-white ring-1 ring-white/10 disabled:opacity-40"
            >
              {pending === amount ? (
                <SpotSpinner size="md" />
              ) : (
                formatNaira(amount)
              )}
            </button>
          ))}
        </div>
        {error ? (
          <p className="mt-3 text-[12px] font-semibold text-danger">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
