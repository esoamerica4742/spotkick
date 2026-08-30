"use client";

import { HighStakesMarkets } from "@/components/home/HighStakesMarkets";
import { ScreenState } from "@/components/brand/ScreenState";
import { TeamPicker } from "@/components/lobby/TeamPicker";
import { useAuth } from "@/hooks/useAuth";
import { useAppMatchmaking } from "@/hooks/MatchmakingProvider";
import { formatNaira } from "@/lib/format";
import { DEFAULT_TEAM_ID, coerceTeamId, type TeamId } from "@/lib/teams";
import { triggerHaptic, unlockAudio } from "@/lib/soundManager";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function greetName(fullName: string) {
  const trimmed = fullName.trim();
  if (
    trimmed === "SpotKick Player" ||
    trimmed === "Spotkicka Player" ||
    trimmed === "SpotKick" ||
    trimmed === "Spotkicka"
  ) {
    return "You";
  }
  return trimmed.split(/\s+/)[0] || "You";
}

export function HomeClient() {
  const router = useRouter();
  const { user, loading: authLoading, setTeam } = useAuth();
  const { queued } = useAppMatchmaking();
  const [teamId, setTeamId] = useState<TeamId>(DEFAULT_TEAM_ID);

  useEffect(() => {
    if (user?.team_id) setTeamId(coerceTeamId(user.team_id));
  }, [user?.team_id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [authLoading, user, router]);

  if (authLoading) return <ScreenState loading body="Opening home." />;
  if (!user) return null;

  const first = greetName(user.full_name);
  const live = queued?.status === "active";
  const waiting = queued?.status === "waiting";

  return (
    <div className="px-5 pb-6 pt-4">
      {waiting || live ? (
        <Link
          href={live ? `/match/${queued.id}` : "/matches"}
          className="mb-4 block rounded-2xl border border-[#e8c547]/35 bg-[#e8c547]/8 px-4 py-2.5"
        >
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#e8c547] uppercase">
            {live ? "Enter match" : "Challenge posted"}
            <span className="ml-2 font-medium tracking-normal text-white/80 normal-case">
              {formatNaira(queued.stake_amount)}
            </span>
          </p>
        </Link>
      ) : null}

      <h1 className="font-display text-[2.15rem] leading-none tracking-[-0.05em] text-white">
        {first}
      </h1>
      <p className="mt-2 text-[13px] text-white/45">Place · time · dive · 90% winner</p>

      <section className="mt-6 rounded-[1.35rem] border border-white/10 bg-white/[0.035] px-3.5 py-3.5">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#e8c547]/80 uppercase">
          Kit
        </p>
        <div className="mt-2.5">
          <TeamPicker
            compact
            selected={teamId}
            onSelect={(next) => {
              setTeamId(next);
              void setTeam(next);
            }}
          />
        </div>
      </section>

      <HighStakesMarkets teamId={teamId} locked={waiting || live} />

      <div className="mt-5 flex justify-center">
        <Link
          href="/match/practice"
          aria-disabled={waiting}
          onClick={(event) => {
            if (waiting) {
              event.preventDefault();
              return;
            }
            unlockAudio();
            triggerHaptic("light");
          }}
          className={`text-[11px] font-semibold tracking-[0.16em] text-white/45 uppercase ${
            waiting ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Practice
        </Link>
      </div>
    </div>
  );
}
