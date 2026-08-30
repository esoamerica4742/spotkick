"use client";

import { formatNaira } from "@/lib/format";
import { type FlashBounty, flashBountyClipboard } from "@/lib/bounty";
import type { Match } from "@/lib/game/types";
import { FLASH_BOUNTY_MS } from "@/lib/constants";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function MatchmakingQueue({
  match,
  bounty,
  shareText,
  waitMs,
  onCancel,
}: {
  match: Match;
  bounty: FlashBounty | null;
  shareText: string | null;
  waitMs: number;
  onCancel: () => void;
}) {
  const waiting = match.status === "waiting";
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(waitMs);

  useEffect(() => {
    setLeft(waitMs);
  }, [waitMs]);

  useEffect(() => {
    if (!waiting || bounty) return;
    const started = Date.now();
    const base = waitMs || FLASH_BOUNTY_MS;
    const id = window.setInterval(() => {
      setLeft(Math.max(0, base - (Date.now() - started)));
    }, 250);
    return () => window.clearInterval(id);
  }, [bounty, waitMs, waiting]);

  async function copy() {
    const text =
      shareText ??
      (bounty
        ? flashBountyClipboard({
            stake: bounty.stake_amount,
            teamId: bounty.team_id,
            url: bounty.share_url,
          })
        : "");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-neon/12 via-black/20 to-transparent p-4 ring-1 ring-neon/35">
      <div className="absolute -right-6 -top-8 size-20 rounded-full bg-neon/20 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-neon uppercase">
            {bounty ? "Flash bounty" : waiting ? "In orbit" : "Locked"}
          </p>
          <p className="mt-1 text-sm text-silver">
            {formatNaira(match.stake_amount)} in escrow
          </p>
        </div>
        {waiting ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[11px] font-semibold text-muted"
          >
            Cancel
          </button>
        ) : null}
      </div>
      {waiting && !bounty ? (
        <>
          <p className="relative mt-3 text-xs text-muted">
            Hunting a rival kit · bounty in {Math.ceil(left / 1000)}s
          </p>
          <div className="relative mt-3 flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1 flex-1 rounded-full bg-neon"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
              />
            ))}
          </div>
        </>
      ) : null}
      {bounty ? (
        <div className="relative mt-3 space-y-2">
          <p className="text-xs text-silver/80">
            Still live. Drop this in WhatsApp.
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            className="btn-primary h-10 w-full rounded-xl text-xs font-bold"
          >
            {copied ? "Copied" : "Copy challenge"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
