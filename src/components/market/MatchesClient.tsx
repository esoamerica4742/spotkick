"use client";

import { ScreenState } from "@/components/brand/ScreenState";
import { CreateMatchSheet } from "@/components/market/CreateMatchSheet";
import { MarketCard } from "@/components/market/MarketCard";
import { useAuth } from "@/hooks/useAuth";
import { useAppMatchmaking } from "@/hooks/MatchmakingProvider";
import { useWallet } from "@/hooks/useWallet";
import { MARKET_TTL_MS, isValidStake } from "@/lib/constants";
import { formatNaira } from "@/lib/format";
import { parseSqliteDate, type MarketRoom } from "@/lib/market";
import { clearLockIntent, readLockIntent } from "@/lib/lock-intent";
import { DEFAULT_TEAM_ID, type TeamId } from "@/lib/teams";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function remainLabel(createdAt: string, now: number) {
  const s = Math.max(
    0,
    Math.ceil((parseSqliteDate(createdAt) + MARKET_TTL_MS - now) / 1000),
  );
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MatchesClient({
  openCreate = false,
}: {
  openCreate?: boolean;
}) {
  const router = useRouter();
  const { user, loading: authLoading, setTeam } = useAuth();
  const { wallet, refresh: refreshWallet } = useWallet();
  const { queued, cancel, refresh } = useAppMatchmaking();
  const [rooms, setRooms] = useState<MarketRoom[]>([]);
  const [teamId, setTeamId] = useState<TeamId>(DEFAULT_TEAM_ID);
  const [open, setOpen] = useState(openCreate);
  const [initialStake, setInitialStake] = useState(1_000);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (user?.team_id) setTeamId(user.team_id);
  }, [user?.team_id]);

  useEffect(() => {
    if (openCreate) setOpen(true);
  }, [openCreate]);

  useEffect(() => {
    if (!user) return;
    const intent = readLockIntent();
    if (intent && isValidStake(intent.amount)) {
      setInitialStake(intent.amount);
      setOpen(true);
      clearLockIntent();
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    const data = await readJson<{ rooms: MarketRoom[] }>(
      await fetch("/api/market", { credentials: "include" }),
    );
    setRooms(data.rooms);
  }, []);

  useEffect(() => {
    if (!user) return;
    void load().catch(() => undefined);
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(id);
  }, [load, user]);

  async function create(stake: number) {
    setError(null);
    setPending(true);
    try {
      await readJson(
        await fetch("/api/market", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stake, teamId }),
        }),
      );
      await Promise.all([load(), refreshWallet(), refresh()]);
      setOpen(false);
      if (openCreate) router.replace("/matches", { scroll: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    } finally {
      setPending(false);
    }
  }

  async function joinRoom(room: MarketRoom) {
    setError(null);
    setBusyId(room.id);
    try {
      const data = await readJson<{ match: { id: string } }>(
        await fetch(`/api/market/${room.id}/join`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ teamId }),
        }),
      );
      router.push(`/match/${data.match.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return <ScreenState loading body="Loading matches." />;
  if (!user) return null;

  const mine = queued?.status === "waiting" ? queued : null;
  const listed = rooms.filter((room) => !room.mine);

  return (
    <div className="px-5 pb-6 pt-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
            Board
          </p>
          <h1 className="mt-1 font-display text-[1.85rem] leading-none tracking-[-0.05em] text-white">
            Matches
          </h1>
        </div>
        <p className="text-[12px] text-white/45">{listed.length} open</p>
      </div>

      {mine ? (
        <section className="mt-3 rounded-[1.45rem] border border-[#e8c547]/35 bg-[#e8c547]/8 px-4 py-3.5">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547] uppercase">
            Your challenge
          </p>
          <p className="mt-1.5 font-display tabular text-[1.85rem] leading-none text-white">
            {formatNaira(mine.stake_amount)}
          </p>
          <p className="mt-2 text-[12px] text-white/55">
            {remainLabel(mine.created_at, now)} left · escrow locked
          </p>
          <button
            type="button"
            onClick={() => void cancel().then(() => load())}
            className="mt-3 text-[12px] font-semibold text-white/70"
          >
            Cancel & refund
          </button>
        </section>
      ) : null}

      {error ? (
        <p className="mt-2 shrink-0 text-[12px] font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 space-y-2.5">
        {listed.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-[1.45rem] border border-white/10 bg-white/[0.035] px-6 text-center">
            <div className="h-px w-10 bg-gradient-to-r from-transparent via-[#e8c547] to-transparent" />
            <p className="mt-4 text-[15px] font-semibold tracking-[-0.02em] text-white">
              No open rooms
            </p>
            <p className="mt-1.5 text-[12px] text-white/45">
              Create a challenge. Rival joins. Escrow locks.
            </p>
          </div>
        ) : (
          listed.map((room) => (
            <MarketCard
              key={room.id}
              room={room}
              busyId={busyId}
              onJoin={(next) => void joinRoom(next)}
            />
          ))
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={Boolean(mine)}
          className="sk-pill disabled:opacity-40"
        >
          Create match
        </button>
      </div>

      <CreateMatchSheet
        open={open}
        teamId={teamId}
        balance={wallet.balance}
        pending={pending}
        error={error}
        initialStake={initialStake}
        onTeam={(next) => {
          setTeamId(next);
          void setTeam(next);
        }}
        onClose={() => {
          setOpen(false);
          if (openCreate) router.replace("/matches", { scroll: false });
        }}
        onCreate={create}
      />
    </div>
  );
}
