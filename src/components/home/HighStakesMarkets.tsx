"use client";

import { formatNaira, initials } from "@/lib/format";
import type { MarketRoom } from "@/lib/market";
import { teamConfig, type TeamId } from "@/lib/teams";
import { SpotSpinner } from "@/components/brand/SpotSpinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 2500;
const ENDPOINT = "/api/markets/open?limit=4&sort=highest";

function labelName(name: string) {
  return name === "SpotKick Player" || name === "Spotkicka Player"
    ? "Player"
    : name;
}

export function HighStakesMarkets({
  teamId,
  locked,
}: {
  teamId: TeamId;
  locked: boolean;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<MarketRoom[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(ENDPOINT, { credentials: "include" });
    const data = (await response.json()) as {
      rooms?: MarketRoom[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "Market failed");
    const next = data.rooms ?? [];
    if (seen.current) {
      const arrived = next.filter((room) => !seen.current!.has(room.id));
      if (arrived.length) {
        const ids = new Set(arrived.map((room) => room.id));
        setFresh(ids);
        window.setTimeout(() => setFresh(new Set()), 1400);
      }
    }
    seen.current = new Set(next.map((room) => room.id));
    setRooms(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void load().catch(() => undefined);
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  async function join(room: MarketRoom) {
    if (room.mine || locked || busyId) return;
    setError(null);
    setBusyId(room.id);
    try {
      const response = await fetch(`/api/market/${room.id}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = (await response.json()) as {
        match?: { id: string };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Could not join");
      if (!data.match?.id) throw new Error("Could not join");
      router.push(`/match/${data.match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setBusyId(null);
    }
  }

  return (
    <section className="mt-3 rounded-[1.35rem] border border-white/10 bg-white/[0.035] px-3.5 py-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e8c547] opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[#e8c547]" />
          </span>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#e8c547]/85 uppercase">
            Live
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loaded ? (
            <p className="text-[11px] text-white/40">{rooms.length} open</p>
          ) : null}
          {loaded && rooms.length > 0 && !locked ? (
            <Link
              href="/matches?create=1"
              className="text-[11px] font-semibold tracking-[0.14em] text-[#e8c547] uppercase"
            >
              Create
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-2 shrink-0 text-[12px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-2">
        {!loaded ? (
          <div className="space-y-2 pt-1">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="h-[3.35rem] animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex min-h-[7.5rem] flex-col items-center justify-center px-4 py-4 text-center">
            <div className="h-px w-10 bg-gradient-to-r from-transparent via-[#e8c547] to-transparent" />
            <p className="mt-3 text-[14px] font-semibold tracking-[-0.02em] text-white">
              No open rooms
            </p>
            <p className="mt-1 text-[12px] text-white/40">
              Post a stake. A rival joins.
            </p>
            {locked ? (
              <p className="mt-3.5 text-[11px] font-semibold tracking-[0.14em] text-white/35 uppercase">
                Finish your match first
              </p>
            ) : (
              <Link href="/matches?create=1" className="sk-pill mt-3.5">
                Create match
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rooms.map((room) => {
              const kit = teamConfig(room.team_id);
              const joining = busyId === room.id;
              const arrived = fresh.has(room.id);
              return (
                <li
                  key={room.id}
                  className={`flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-colors ${
                    arrived ? "bg-[#e8c547]/10 ring-1 ring-[#e8c547]/40" : ""
                  }`}
                >
                  {room.creator_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.creator_avatar}
                      alt=""
                      className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/70 ring-1 ring-white/10">
                      {initials(labelName(room.creator_name))}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
                      {labelName(room.creator_name)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/42">
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-[3px] ring-1 ring-white/20"
                        style={{ background: kit.primary }}
                      />
                      <span className="truncate">{kit.short}</span>
                    </p>
                  </div>
                  <p className="shrink-0 font-display tabular text-[1.05rem] leading-none text-[#e8c547]">
                    {formatNaira(room.stake_amount)}
                  </p>
                  {room.mine ? (
                    <span className="shrink-0 px-1 text-[10px] font-semibold tracking-[0.12em] text-[#e8c547] uppercase">
                      Yours
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={joining || locked}
                      onClick={() => void join(room)}
                      className="flex h-9 shrink-0 items-center justify-center rounded-full bg-white px-3 text-[11px] font-semibold tracking-[-0.02em] text-black disabled:opacity-40"
                    >
                      {joining ? (
                        <SpotSpinner size="xs" />
                      ) : (
                        "Join"
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
