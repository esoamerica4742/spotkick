"use client";

import { ResultModal } from "@/components/match/ResultModal";
import { ScoreBoard, type KickMark } from "@/components/match/ScoreBoard";
import type { KickPlay } from "@/components/match/stadium/Scene";
import { CHOICE_WINDOW_MS, CPU_KEEPER_MS, KICKS_PER_PLAYER, type Zone } from "@/lib/constants";
import { choiceWindowMs } from "@/lib/game/window";
import type { KeeperPacket } from "@/lib/game/keeper-packet";
import {
  bodyRead,
  coverRadiusMilli,
  cpuReadCover,
  cpuStrikePlan,
  matchWinner,
  randomCpuAccuracy,
  resolveAim,
  whyCopy,
  zoneFromMilliX,
  type AimPoint,
  type KickResolution,
} from "@/lib/game/engine";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const PenaltyStadium = dynamic(
  () =>
    import("@/components/match/stadium/PenaltyStadium").then(
      (mod) => mod.PenaltyStadium,
    ),
  { ssr: false },
);

type PracticeRole = "shooter" | "keeper";

function nextWindow(ms = CHOICE_WINDOW_MS) {
  return new Date(Date.now() + ms).toISOString();
}

function emptyMarks(): KickMark[] {
  return Array.from({ length: KICKS_PER_PLAYER }, () => "pending");
}

export function PracticeMatch() {
  const router = useRouter();
  const [role, setRole] = useState<PracticeRole>("shooter");
  const [selected, setSelected] = useState<Zone | null>(null);
  const [play, setPlay] = useState<KickPlay | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [runup, setRunup] = useState<AimPoint | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [youMarks, setYouMarks] = useState<KickMark[]>(emptyMarks);
  const [oppMarks, setOppMarks] = useState<KickMark[]>(emptyMarks);
  const [kicksDone, setKicksDone] = useState(0);
  const [setOver, setSetOver] = useState(false);
  const kickTimer = useRef<number | null>(null);
  const cpuStrike = useRef<{ aim: AimPoint; accuracy: number } | null>(null);
  const roleRef = useRef(role);
  roleRef.current = role;
  const kicksRef = useRef(0);
  const youScoreRef = useRef(0);
  const oppScoreRef = useRef(0);
  youScoreRef.current = youScore;
  oppScoreRef.current = oppScore;

  const clearKickTimer = useCallback(() => {
    if (kickTimer.current) {
      window.clearTimeout(kickTimer.current);
      kickTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearKickTimer(), [clearKickTimer]);

  useEffect(() => {
    setClosesAt(nextWindow());
  }, []);

  const showPlay = useCallback(
    (
      resolved: KickResolution,
      shot: AimPoint | null,
      cover: AimPoint | null,
      keeperAcc: number,
      asRole: PracticeRole,
      kickerAcc: number,
    ) => {
      const nextKick = kicksRef.current + 1;
      kicksRef.current = nextKick;
      setKicksDone(nextKick);
      if (asRole === "shooter") {
        const mark: KickMark = resolved.outcome === "goal" ? "goal" : "saved";
        setYouMarks((marks) => {
          const next = [...marks];
          const slot = next.findIndex((item) => item === "pending" || item === "active");
          if (slot >= 0) next[slot] = mark;
          else next.push(mark);
          return next.slice(0, Math.max(KICKS_PER_PLAYER, next.length));
        });
        if (resolved.outcome === "goal") {
          youScoreRef.current += 1;
          setYouScore(youScoreRef.current);
        }
      } else {
        const mark: KickMark = resolved.outcome === "goal" ? "goal" : "saved";
        setOppMarks((marks) => {
          const next = [...marks];
          const slot = next.findIndex((item) => item === "pending" || item === "active");
          if (slot >= 0) next[slot] = mark;
          else next.push(mark);
          return next.slice(0, Math.max(KICKS_PER_PLAYER, next.length));
        });
        if (resolved.outcome === "goal") {
          oppScoreRef.current += 1;
          setOppScore(oppScoreRef.current);
        }
      }
      setStatus(null);
      setPlay({
        roundId: crypto.randomUUID(),
        shooter: shot ? zoneFromMilliX(shot.x) : null,
        keeper: cover ? zoneFromMilliX(cover.x) : null,
        intentX: shot?.x ?? null,
        intentY: shot?.y ?? null,
        shotX: resolved.actual?.x ?? shot?.x ?? 0,
        shotY: resolved.actual?.y ?? shot?.y ?? 0,
        coverX: cover?.x ?? null,
        coverY: cover?.y ?? null,
        coverRadius: cover ? coverRadiusMilli(keeperAcc) : null,
        reason: whyCopy(resolved.why),
        outcome: resolved.outcome,
        finish: resolved.finish,
        kickAcc: kickerAcc,
        kickIndex: nextKick,
        wagerAmount: 0,
      });
    },
    [],
  );

  const armKeeperTurn = useCallback(() => {
    clearKickTimer();
    const plan = cpuStrikePlan();
    cpuStrike.current = plan;
    setRunup(bodyRead(plan.aim, plan.accuracy));
    setSelected(null);
    setStatus("Read the plant");
    setClosesAt(null);
  }, [clearKickTimer]);

  const onLock = useCallback(
    (aim: AimPoint, accuracy: number, packet?: KeeperPacket) => {
      if (play || selected || setOver) return;
      const asRole = roleRef.current;
      if (asRole === "shooter") {
        setSelected(zoneFromMilliX(aim.x));
        setRunup(aim);
        setStatus("Keeper reads the plant");
        setClosesAt(null);
        clearKickTimer();
        kickTimer.current = window.setTimeout(() => {
          const keeperAcc = randomCpuAccuracy();
          const cover = cpuReadCover(aim, keeperAcc, accuracy);
          const resolved = resolveAim(aim, cover, accuracy, keeperAcc);
          showPlay(resolved, aim, cover, keeperAcc, "shooter", accuracy);
        }, CPU_KEEPER_MS);
        return;
      }
      const strike = cpuStrike.current;
      if (!strike) return;
      clearKickTimer();
      const score = packet?.executionScore ?? accuracy;
      setSelected(zoneFromMilliX(aim.x));
      const resolved = resolveAim(strike.aim, aim, strike.accuracy, score);
      showPlay(resolved, strike.aim, aim, score, "keeper", strike.accuracy);
    },
    [play, selected, setOver, clearKickTimer, showPlay],
  );

  const resetSet = useCallback(() => {
    clearKickTimer();
    kicksRef.current = 0;
    youScoreRef.current = 0;
    oppScoreRef.current = 0;
    setYouScore(0);
    setOppScore(0);
    setYouMarks(emptyMarks());
    setOppMarks(emptyMarks());
    setKicksDone(0);
    setSetOver(false);
    setPlay(null);
    setSelected(null);
    setStatus(null);
    setRunup(null);
    cpuStrike.current = null;
    setRole("shooter");
    setClosesAt(nextWindow());
  }, [clearKickTimer]);

  const onPlaybackEnd = useCallback(() => {
    clearKickTimer();
    const done = kicksRef.current;
    const winner = matchWinner(youScoreRef.current, oppScoreRef.current, done);
    if (winner) {
      setPlay(null);
      setSelected(null);
      setRunup(null);
      cpuStrike.current = null;
      setSetOver(true);
      setClosesAt(null);
      return;
    }
    const next: PracticeRole = roleRef.current === "shooter" ? "keeper" : "shooter";
    setPlay(null);
    setSelected(null);
    setStatus(null);
    setRunup(null);
    cpuStrike.current = null;
    setRole(next);
    if (next === "keeper") {
      armKeeperTurn();
    } else {
      setClosesAt(nextWindow());
    }
  }, [clearKickTimer, armKeeperTurn]);

  const onExpire = useCallback(() => {
    if (play || selected || setOver) return;
    if (roleRef.current === "shooter") {
      const resolved = resolveAim(null, null, 0, 0);
      showPlay(resolved, null, null, 0, "shooter", 0);
    }
  }, [play, selected, setOver, showPlay]);

  const onReactTimeout = useCallback(() => {
    if (play || selected || setOver) return;
    if (roleRef.current !== "keeper") return;
    const strike = cpuStrike.current;
    if (!strike) return;
    const resolved = resolveAim(strike.aim, null, strike.accuracy, 0);
    showPlay(resolved, strike.aim, null, 0, "keeper", strike.accuracy);
  }, [play, selected, setOver, showPlay]);

  const suddenDeath = kicksDone > KICKS_PER_PLAYER * 2;

  return (
    <>
      <PenaltyStadium
        role={role}
        selected={selected}
        locked={Boolean(play) || (role === "shooter" && Boolean(selected)) || setOver}
        disabled={Boolean(play) || setOver}
        play={play}
        status={status}
        runup={play ? null : runup}
        shooterTeamId={role === "shooter" ? "home" : "away"}
        keeperTeamId={role === "shooter" ? "away" : "home"}
        shooterSeat={role === "shooter" ? "a" : "b"}
        onLock={onLock}
        onReactTimeout={onReactTimeout}
        onPlaybackEnd={onPlaybackEnd}
        header={
          <ScoreBoard
            youName="You"
            oppName={role === "shooter" ? "Keeper" : "Kicker"}
            youScore={youScore}
            oppScore={oppScore}
            stake={0}
            round={Math.max(1, kicksDone)}
            suddenDeath={suddenDeath}
            youTeamId="home"
            oppTeamId="away"
            youMarks={youMarks}
            oppMarks={oppMarks}
            phaseLabel={
              setOver
                ? "Final"
                : suddenDeath
                  ? "Sudden death"
                  : role === "shooter"
                    ? "You shoot"
                    : "You dive"
            }
            closesAt={play || role === "keeper" || setOver ? null : closesAt}
            windowMs={choiceWindowMs("shooter")}
            onExpire={onExpire}
            onExit={() => router.push("/home")}
          />
        }
      />
      <ResultModal
        open={setOver && !play}
        won={youScore > oppScore}
        payout={0}
        youScore={youScore}
        oppScore={oppScore}
        onLobby={() => router.push("/home")}
        onRematch={resetSet}
      />
    </>
  );
}
