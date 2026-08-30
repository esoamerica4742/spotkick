"use client";

import { useAuth } from "@/hooks/useAuth";
import { type FlashBounty } from "@/lib/bounty";
import type { Match } from "@/lib/game/types";
import { type TeamId } from "@/lib/teams";
import { enterMatchFullscreen } from "@/lib/fullscreen";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

type PoolEvent = {
  type?: string;
  match?: Match;
  bounty?: FlashBounty;
  shareText?: string;
  waitMs?: number;
  error?: string;
};

export function useMatchmaking() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Match | null>(null);
  const [bounty, setBounty] = useState<FlashBounty | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [waitMs, setWaitMs] = useState(0);
  const socket = useRef<WebSocket | null>(null);

  const goArena = useCallback(
    (matchId: string) => {
      void enterMatchFullscreen();
      router.push(`/match/${matchId}`);
    },
    [router],
  );

  const refresh = useCallback(async () => {
    const data = await readJson<{
      match: Match | null;
      bounty: FlashBounty | null;
    }>(await fetch("/api/matchmaking/current", { credentials: "include" }));
    setQueued(data.match);
    setBounty(data.bounty);
    if (
      data.match?.status === "active" &&
      pathname === "/lobby"
    ) {
      goArena(data.match.id);
    }
  }, [goArena, pathname]);

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "Queue failed");
    });
    const poll = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(poll);
  }, [refresh, user]);

  useEffect(() => {
    if (!user || !queued || queued.status !== "waiting") {
      socket.current?.close();
      socket.current = null;
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/api/ws/pool/${queued.stake_amount}`,
    );
    socket.current = ws;
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as PoolEvent;
        if (payload.match) setQueued(payload.match);
        if (typeof payload.waitMs === "number") setWaitMs(payload.waitMs);
        if (payload.bounty) setBounty(payload.bounty);
        if (payload.shareText) setShareText(payload.shareText);
        if (payload.type === "matched" && payload.match) {
          goArena(payload.match.id);
        }
        if (payload.error) setError(payload.error);
      } catch {
        // Ignore malformed frames.
      }
    };
    return () => {
      ws.close();
      socket.current = null;
    };
  }, [goArena, queued?.id, queued?.status, queued?.stake_amount, user]);

  const join = useCallback(
    async (stake: number, teamId: TeamId) => {
      setError(null);
      setPending(true);
      try {
        await enterMatchFullscreen();
        const data = await readJson<{ match: Match }>(
          await fetch("/api/matchmaking/join", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ stake, teamId }),
          }),
        );
        setQueued(data.match);
        if (data.match.status === "active") {
          goArena(data.match.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join queue");
      } finally {
        setPending(false);
      }
    },
    [goArena],
  );

  const cancel = useCallback(async () => {
    setError(null);
    await fetch("/api/matchmaking/cancel", {
      method: "POST",
      credentials: "include",
    });
    setQueued(null);
    setBounty(null);
    setShareText(null);
  }, []);

  return {
    join,
    cancel,
    pending,
    error,
    queued,
    bounty,
    shareText,
    waitMs,
    refresh,
  };
}
