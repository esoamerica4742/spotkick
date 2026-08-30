"use client";

import { Logo } from "@/components/brand/Logo";
import { BottomNav } from "@/components/nav/BottomNav";
import { useWallet } from "@/hooks/useWallet";
import { formatNaira } from "@/lib/format";
import type { ReactNode } from "react";

export function AppChrome({ children }: { children: ReactNode }) {
  const { wallet } = useWallet();

  return (
    <div
      data-chrome
      className="relative isolate z-10 mx-auto flex h-svh max-h-svh w-full max-w-md flex-col overflow-hidden bg-oled"
    >
      <header className="relative z-50 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-oled px-5 pb-3 pt-[max(1.05rem,calc(env(safe-area-inset-top)+0.4rem))]">
        <Logo size="sm" />
        <p className="font-display tabular text-[1.2rem] leading-none text-[#e8c547]">
          {formatNaira(wallet.balance)}
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
