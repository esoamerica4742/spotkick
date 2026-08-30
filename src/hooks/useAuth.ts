"use client";

import { coerceTeamId, DEFAULT_TEAM_ID, type TeamId } from "@/lib/teams";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  team_id: TeamId;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/me", { credentials: "include" });
    const data = await readJson<{ user: AuthUser | null }>(response);
    setUser(
      data.user
        ? { ...data.user, team_id: coerceTeamId(data.user.team_id ?? DEFAULT_TEAM_ID) }
        : null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh().catch(() => {
      setUser(null);
      setLoading(false);
    });
  }, [refresh]);

  const signInWithGoogle = useCallback(async () => {
    await readJson(
      await fetch("/api/auth/google", {
        method: "POST",
        credentials: "include",
      }),
    );
    await refresh();
    router.push("/home");
  }, [refresh, router]);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    return readJson<{ delivered: boolean; code?: string; retryAfterSec?: number }>(
        await fetch("/api/auth/otp/send", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
    );
  }, []);

  const verifyPhoneOtp = useCallback(
    async (phone: string, token: string) => {
      await readJson(
        await fetch("/api/auth/otp/verify", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, token }),
        }),
      );
      await refresh();
      router.push("/home");
    },
    [refresh, router],
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    router.push("/");
  }, [router]);

  const setTeam = useCallback(async (teamId: TeamId) => {
    await readJson(
      await fetch("/api/wallet", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId }),
      }),
    );
    setUser((current) => (current ? { ...current, team_id: teamId } : current));
  }, []);

  const setName = useCallback(async (fullName: string) => {
    const data = await readJson<{ user: AuthUser }>(
      await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName }),
      }),
    );
    setUser((current) =>
      current ? { ...current, full_name: data.user.full_name } : current,
    );
  }, []);

  return {
    user,
    loading,
    configured: true,
    signInWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    signOut,
    setTeam,
    setName,
    refresh,
  };
}
