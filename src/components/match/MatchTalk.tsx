"use client";

import { triggerHaptic, unlockAudio } from "@/lib/soundManager";
import type { MatchChatMessage } from "@/lib/game/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function firstName(name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  if (
    !trimmed ||
    trimmed === "SpotKick Player" ||
    trimmed === "Spotkicka Player" ||
    trimmed === "SpotKick" ||
    trimmed === "Spotkicka"
  ) {
    return "Rival";
  }
  return trimmed.split(/\s+/)[0] ?? "Rival";
}

function lastSpoken(messages: MatchChatMessage[], youId: string, rival: string) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (!item?.fromId) continue;
    const who = item.fromId === youId ? "You" : rival;
    return `${who}: ${item.text}`;
  }
  return null;
}

export function MatchTalk({
  youId,
  oppName,
  oppHere,
  oppTyping,
  messages,
  hidden,
  mustPlay,
  chatError,
  onSend,
  onTyping,
}: {
  youId: string;
  oppName: string | null | undefined;
  oppHere: boolean;
  oppTyping: boolean;
  messages: MatchChatMessage[];
  hidden?: boolean;
  mustPlay?: boolean;
  chatError?: string | null;
  onSend: (text: string) => void;
  onTyping: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [echo, setEcho] = useState<MatchChatMessage | null>(null);
  const [mounted, setMounted] = useState(false);
  const seen = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const rival = firstName(oppName);

  const shown = useMemo(() => {
    if (!echo) return messages;
    if (messages.some((item) => item.fromId === youId && item.text === echo.text)) {
      return messages;
    }
    return [...messages, echo];
  }, [echo, messages, youId]);

  const preview = oppTyping
    ? `${rival} is writing`
    : lastSpoken(messages, youId, rival);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mustPlay && open) setOpen(false);
  }, [mustPlay, open]);

  useEffect(() => {
    if (chatError) setEcho(null);
  }, [chatError]);

  useEffect(() => {
    if (
      echo &&
      messages.some((item) => item.fromId === youId && item.text === echo.text)
    ) {
      setEcho(null);
    }
  }, [echo, messages, youId]);

  useEffect(() => {
    if (open) {
      seen.current = messages.length;
      setUnread(0);
      return;
    }
    const extra = messages
      .slice(seen.current)
      .filter((item) => item.fromId && item.fromId !== youId).length;
    if (extra > 0) setUnread(extra);
  }, [messages, open, youId]);

  useEffect(() => {
    if (!open) return;
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [shown, open, oppTyping]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => field.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (open || messages.length <= seen.current) return;
    const last = messages[messages.length - 1];
    if (last && last.fromId && last.fromId !== youId) {
      triggerHaptic("light");
    }
  }, [messages, open, youId]);

  if (hidden) return null;

  function send() {
    const text = draft.trim();
    if (!text) return;
    unlockAudio();
    triggerHaptic("light");
    setEcho({
      id: `echo-${Date.now()}`,
      fromId: youId,
      text,
      at: new Date().toISOString(),
    });
    onSend(text);
    setDraft("");
  }

  const status = oppTyping ? "Writing" : oppHere ? "Here" : "Away";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (mustPlay) return;
          unlockAudio();
          setOpen((value) => !value);
        }}
        className="mt-1.5 flex w-full items-center gap-2.5 rounded-2xl border border-white/12 bg-black/50 px-3 py-1.5 text-left backdrop-blur-md"
      >
        <span className="relative mt-0.5 flex size-2 shrink-0">
          {oppHere ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-[#00FF66] opacity-55" />
          ) : null}
          <span
            className={`relative size-2 rounded-full ${
              oppHere
                ? "bg-[#00FF66] shadow-[0_0_8px_rgba(0,255,102,0.9)]"
                : "bg-white/25"
            }`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold tracking-[0.12em] text-white/85 uppercase">
              {rival}
            </span>
            <span className="shrink-0 text-[9px] font-semibold tracking-[0.18em] text-[#e8c547] uppercase">
              Human
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/45">
            {preview ?? (oppHere ? "Private line · only you two" : `Waiting for ${rival}`)}
          </span>
        </span>
        <span className="shrink-0 text-right text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">
          {status}
          {unread > 0 ? (
            <span className="ml-1.5 inline-flex min-w-[1.1rem] justify-center rounded-full bg-[#00FF66] px-1 text-[9px] text-black">
              {unread}
            </span>
          ) : null}
        </span>
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && !mustPlay ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed inset-x-3 top-[max(8.6rem,calc(env(safe-area-inset-top)+7.6rem))] z-[80] overflow-hidden rounded-[1.25rem] border border-white/12 bg-oled/94 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                >
            <div className="flex items-center justify-between border-b border-white/8 px-3.5 py-2.5">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#e8c547] uppercase">
                  Human vs human
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  Only you and {rival} see this
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase"
              >
                Close
              </button>
            </div>
            <div
              ref={scroller}
              className="max-h-[32vh] space-y-2 overflow-y-auto px-3.5 py-3"
            >
              {shown.length === 0 ? (
                <p className="text-center text-[12px] leading-relaxed text-white/40">
                  {oppHere
                    ? `${rival} is on this pitch. Talk like you would in the street — they are real.`
                    : `Waiting for ${rival} to enter.`}
                </p>
              ) : (
                shown.map((item) => {
                  if (!item.fromId) {
                    return (
                      <p
                        key={item.id}
                        className="text-center text-[10px] font-semibold tracking-[0.14em] text-[#e8c547]/80 uppercase"
                      >
                        {item.text}
                      </p>
                    );
                  }
                  const mine = item.fromId === youId;
                  return (
                    <div
                      key={item.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <p
                        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                          mine
                            ? "bg-white text-black"
                            : "border border-white/12 bg-white/[0.07] text-white"
                        }`}
                      >
                        {item.text}
                      </p>
                    </div>
                  );
                })
              )}
              {oppTyping ? (
                <p className="text-[10px] font-semibold tracking-[0.14em] text-white/40 uppercase">
                  {rival} is writing
                </p>
              ) : null}
              {chatError ? (
                <p className="text-center text-[11px] text-[#ff6b6b]">{chatError}</p>
              ) : null}
            </div>
            <form
              className="flex gap-2 border-t border-white/8 px-3 py-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <input
                ref={field}
                value={draft}
                maxLength={80}
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="on"
                placeholder={`To ${rival}`}
                onChange={(event) => {
                  setDraft(event.target.value);
                  onTyping();
                }}
                className="h-10 min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.05] px-3.5 text-[14px] text-white outline-none placeholder:text-white/30"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="h-10 shrink-0 rounded-full bg-white px-4 text-[11px] font-semibold tracking-[0.12em] text-black uppercase disabled:opacity-30"
              >
                Send
              </button>
            </form>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
