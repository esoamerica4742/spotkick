"use client";

import { DepositSheet } from "@/components/lobby/DepositSheet";
import { ScreenState } from "@/components/brand/ScreenState";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { formatNaira } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function WalletClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { wallet, deposit } = useWallet();
  const [depositOpen, setDepositOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <ScreenState loading body="Opening wallet." />;
  if (!user) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-5 pb-3 pt-3">
      <section className="shrink-0 rounded-[1.45rem] border border-white/10 bg-white/[0.035] px-4 py-5">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
          Available
        </p>
        <p className="mt-2 font-display tabular text-[2.55rem] leading-none text-[#e8c547]">
          {formatNaira(wallet.balance)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
              In escrow
            </p>
            <p className="mt-1.5 font-display tabular text-[1.2rem] leading-none text-white">
              {formatNaira(wallet.ledger_balance)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
              Winner takes
            </p>
            <p className="mt-1.5 font-display text-[1.2rem] leading-none text-white">
              90%
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setDepositOpen(true)}
        className="mt-3 flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-white text-[16px] font-semibold tracking-[-0.02em] text-black"
      >
        Deposit
      </button>
      <button
        type="button"
        disabled
        className="mt-2 flex h-12 w-full shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-[13px] font-semibold tracking-[0.08em] text-white/35 uppercase"
      >
        Cashout soon
      </button>

      <section className="mt-3 shrink-0 rounded-[1.45rem] border border-white/10 bg-white/[0.035] px-4 py-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
          How lock works
        </p>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/58">
          <li>Stake leaves available when you post or join.</li>
          <li>It stays locked until the match ends or is cancelled.</li>
          <li>No rival in 3 minutes — full refund.</li>
        </ul>
      </section>

      <DepositSheet
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        onConfirm={deposit}
      />
    </div>
  );
}
