"use client";

import { MiniJersey } from "@/components/brand/MiniJersey";
import { CountdownTimer } from "@/components/match/CountdownTimer";
import { formatNaira } from "@/lib/format";
import {
  CHOICE_WINDOW_MS,
  KICKS_PER_PLAYER,
  REGULATION_KICKS,
} from "@/lib/constants";
import type { Round, RoundOutcome } from "@/lib/game/types";
import { teamConfig, type TeamId } from "@/lib/teams";
import { motion } from "framer-motion";

export type KickMark = Exclude<RoundOutcome, "pending"> | "pending" | "active";

export function marksForShooter(
  rounds: Round[],
  shooterId: string,
  currentRound: number,
): KickMark[] {
  const shots = rounds
    .filter((round) => round.shooter_id === shooterId)
    .sort((a, b) => a.round_number - b.round_number);
  const marks: KickMark[] = [];
  for (let i = 0; i < KICKS_PER_PLAYER; i += 1) {
    const shot = shots[i];
    if (!shot) {
      marks.push("pending");
    } else if (shot.outcome === "pending") {
      marks.push(shot.round_number === currentRound ? "active" : "pending");
    } else {
      marks.push(shot.outcome);
    }
  }
  return marks;
}

function shortName(name: string) {
  const token = name.trim().split(/\s+/)[0] ?? name;
  return token.length > 12 ? `${token.slice(0, 11)}…` : token;
}

export function ScoreBoard({
  youName,
  oppName,
  youScore,
  oppScore,
  stake,
  round,
  suddenDeath,
  complete,
  youMarks,
  oppMarks,
  phaseLabel,
  youTeamId,
  oppTeamId,
  closesAt,
  windowMs = CHOICE_WINDOW_MS,
  onExpire,
  onExit,
}: {
  youName: string;
  oppName: string;
  youScore: number;
  oppScore: number;
  stake: number;
  round: number;
  suddenDeath: boolean;
  complete?: boolean;
  youMarks?: KickMark[];
  oppMarks?: KickMark[];
  phaseLabel?: string;
  youTeamId?: TeamId | null;
  oppTeamId?: TeamId | null;
  closesAt?: string | null;
  windowMs?: number;
  onExpire?: () => void;
  onExit?: () => void;
}) {
  const phase =
    phaseLabel ??
    (complete
      ? "Final"
      : suddenDeath
        ? "Sudden death"
        : `Kick ${Math.min(round, REGULATION_KICKS)} / ${REGULATION_KICKS}`);

  return (
    <div className="flex items-center gap-1.5">
      {onExit ? (
        <button
          type="button"
          aria-label="Leave match"
          onClick={onExit}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/14 bg-black/60 text-white/75 backdrop-blur-md transition-colors hover:border-white/35 hover:bg-black/80 hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path
              d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

      <div className="glass min-w-0 flex-1 overflow-hidden rounded-[1.2rem] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold tracking-[0.14em] text-white/45 uppercase">
            {phase}
          </span>
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] text-gold uppercase">
            {stake > 0 ? `${formatNaira(stake)} · 90%` : "Practice"}
          </span>
        </div>

        <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <PlayerChip
            name={youName}
            teamId={youTeamId}
            marks={youMarks}
            align="left"
          />
          <div className="flex items-end justify-center gap-1 font-display tabular leading-none text-white">
            <motion.span
              key={youScore}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-[2.05rem]"
            >
              {youScore}
            </motion.span>
            <span className="mb-1 text-sm text-white/30">–</span>
            <motion.span
              key={`o-${oppScore}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-[2.05rem]"
            >
              {oppScore}
            </motion.span>
          </div>
          <PlayerChip
            name={oppName}
            teamId={oppTeamId}
            marks={oppMarks}
            align="right"
          />
        </div>
      </div>

      {closesAt && onExpire && !complete ? (
        <CountdownTimer
          closesAt={closesAt}
          windowMs={windowMs}
          onExpire={onExpire}
        />
      ) : null}
    </div>
  );
}

function PlayerChip({
  name,
  align,
  marks,
  teamId,
}: {
  name: string;
  align: "left" | "right";
  marks?: KickMark[];
  teamId?: TeamId | null;
}) {
  const team = teamConfig(teamId);
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 ${align === "right" ? "items-end" : "items-start"}`}
    >
      <div
        className={`flex min-w-0 items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <MiniJersey
          teamId={teamId ?? "home"}
          size="xs"
          className="mx-0 shrink-0"
        />
        <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
          <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.02em] text-white">
            {shortName(name)}
          </p>
          <p className="truncate text-[10px] font-semibold tracking-[0.1em] text-white/40 uppercase">
            {team.short}
          </p>
        </div>
      </div>
      {marks ? <KickDots marks={marks} /> : null}
    </div>
  );
}

function KickDots({ marks }: { marks: KickMark[] }) {
  return (
    <div className="flex gap-1">
      {marks.map((mark, index) => (
        <span
          key={`${mark}-${index}`}
          className={`block size-1.5 rounded-full ${
            mark === "goal"
              ? "bg-neon"
              : mark === "saved"
                ? "bg-danger"
                : mark === "active"
                  ? "bg-gold shadow-[0_0_8px_rgba(232,197,71,0.85)]"
                  : "bg-white/22"
          }`}
        />
      ))}
    </div>
  );
}
