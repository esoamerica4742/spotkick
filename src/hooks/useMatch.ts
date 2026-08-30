"use client";

import { useAuth } from "@/hooks/useAuth";
import type { AimPoint } from "@/lib/game/engine";
import type { MatchView } from "@/lib/game/types";
import { useCallback, useEffect, useRef, useState } from "react";

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function useMatch(matchId: string) {
  const { user } = useAuth();
  const [view, setView] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oppTyping, setOppTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const typingAt = useRef(0);
  const typingClear = useRef<number | null>(null);
  const chatFailClear = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const data = await readJson<{ view: MatchView }>(
      await fetch(`/api/match/${matchId}`, { credentials: "include" }),
    );
    setView((prev) => {
      const next = data.view;
      if (socket.current?.readyState === WebSocket.OPEN && prev) {
        return prev;
      }
      return {
        ...next,
        chat: next.chat?.length ? next.chat : (prev?.chat ?? []),
      };
    });
  }, [matchId]);

  useEffect(() => {
    if (!user) return;
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "Match failed");
    });

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/api/ws/match/${matchId}`,
    );
    socket.current = ws;
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          type?: string;
          view?: MatchView;
          error?: string;
        };
        if (payload.view) {
          setView(payload.view);
          const last = payload.view.chat?.at(-1);
          if (last?.fromId && last.fromId !== user.id) setOppTyping(false);
        }
        if (payload.type === "typing") {
          setOppTyping(true);
          if (typingClear.current) window.clearTimeout(typingClear.current);
          typingClear.current = window.setTimeout(() => {
            setOppTyping(false);
            typingClear.current = null;
          }, 1600);
        }
        if (payload.type === "chat_error") {
          setChatError(payload.error ?? "That line did not go through");
          if (chatFailClear.current) window.clearTimeout(chatFailClear.current);
          chatFailClear.current = window.setTimeout(() => {
            setChatError(null);
            chatFailClear.current = null;
          }, 2400);
          return;
        }
        if (payload.error) setError(payload.error);
      } catch {
        // Ignore malformed frames.
      }
    };

    const poll = window.setInterval(() => {
      if (socket.current?.readyState === WebSocket.OPEN) return;
      void refresh().catch(() => undefined);
    }, 1200);

    return () => {
      window.clearInterval(poll);
      if (typingClear.current) window.clearTimeout(typingClear.current);
      if (chatFailClear.current) window.clearTimeout(chatFailClear.current);
      ws.close();
      socket.current = null;
    };
  }, [matchId, refresh, user]);

  const submit = useCallback(
    async (
      aim: AimPoint,
      accuracy = 100,
      packet?: { timeElapsed: number; executionScore: number },
    ) => {
      const clientTs = performance.now();
      const executionScore = packet?.executionScore ?? accuracy;
      const body = {
        type: "aim" as const,
        x: aim.x,
        y: aim.y,
        timeElapsed: packet?.timeElapsed,
        executionScore,
        accuracyScore: executionScore,
        clientTs,
      };
      if (socket.current?.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify(body));
        return;
      }
      const data = await readJson<{ view: MatchView }>(
        await fetch(`/api/match/${matchId}/choice`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setView(data.view);
    },
    [matchId],
  );

  const expire = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const sendChat = useCallback((text: string) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ type: "chat", text }));
  }, []);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingAt.current < 700) return;
    typingAt.current = now;
    if (socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify({ type: "typing" }));
  }, []);

  const forfeit = useCallback(
    async (keepalive = false) => {
      if (keepalive) {
        void fetch(`/api/match/${matchId}/forfeit`, {
          method: "POST",
          credentials: "include",
          keepalive: true,
        });
        return;
      }
      const data = await readJson<{ view?: MatchView }>(
        await fetch(`/api/match/${matchId}/forfeit`, {
          method: "POST",
          credentials: "include",
        }),
      );
      if (data.view) setView(data.view);
    },
    [matchId],
  );

  return {
    view,
    error,
    submit,
    expire,
    refresh,
    forfeit,
    sendChat,
    sendTyping,
    oppTyping,
    chatError,
    user,
  };
}
