"use client";

import { useCallback, useEffect, useState } from "react";

export type WalletState = {
  balance: number;
  ledger_balance: number;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    balance: 0,
    ledger_balance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await readJson<{
      wallet: { balance: number; ledger_balance: number };
    }>(await fetch("/api/wallet", { credentials: "include" }));
    setWallet({
      balance: Number(data.wallet.balance),
      ledger_balance: Number(data.wallet.ledger_balance),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "Wallet failed");
      setLoading(false);
    });
  }, [refresh]);

  const deposit = useCallback(
    async (amount: number) => {
      setError(null);
      const data = await readJson<{
        wallet: { balance: number; ledger_balance: number };
      }>(
        await fetch("/api/wallet/deposit", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount }),
        }),
      );
      setWallet({
        balance: Number(data.wallet.balance),
        ledger_balance: Number(data.wallet.ledger_balance),
      });
    },
    [],
  );

  return { wallet, loading, error, deposit, refresh };
}
