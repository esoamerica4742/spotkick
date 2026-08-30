"use client";

import { formatNaira } from "@/lib/format";
import { motion } from "framer-motion";

export function WalletCard({
  balance,
  ledger,
  onDeposit,
}: {
  balance: number;
  ledger: number;
  onDeposit: () => void;
}) {
  return (
    <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.035] px-4 py-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
          Available
        </p>
        <button
          type="button"
          onClick={onDeposit}
          className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/80 uppercase"
        >
          Top up
        </button>
      </div>
      <motion.p
        key={balance}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mt-2 font-display tabular text-[2.55rem] leading-none text-[#e8c547]"
      >
        {formatNaira(balance)}
      </motion.p>
      <div className="mx-auto mt-4 h-px w-10 bg-gradient-to-r from-transparent via-[#e8c547] to-transparent" />
      <p className="mt-4 text-[12px] text-white/45">
        Escrow{" "}
        <span className="font-semibold text-white/80">{formatNaira(ledger)}</span>
      </p>
    </div>
  );
}
