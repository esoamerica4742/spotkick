"use client";

import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Download } from "lucide-react";

export function InstallAppButton({ className = "" }: { className?: string }) {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold tracking-[-0.02em] text-black ${className}`}
    >
      <Download className="size-5" strokeWidth={2.4} />
      Install Spotkicka
    </button>
  );
}
