"use client";

import { useMatchmaking } from "@/hooks/useMatchmaking";
import { createContext, useContext, type ReactNode } from "react";

type MatchmakingApi = ReturnType<typeof useMatchmaking>;

const MatchmakingContext = createContext<MatchmakingApi | null>(null);

export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const value = useMatchmaking();
  return (
    <MatchmakingContext.Provider value={value}>
      {children}
    </MatchmakingContext.Provider>
  );
}

export function useAppMatchmaking() {
  const ctx = useContext(MatchmakingContext);
  if (!ctx) {
    throw new Error("useAppMatchmaking must be used inside MatchmakingProvider");
  }
  return ctx;
}
