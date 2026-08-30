"use client";

import { ScreenState } from "@/components/brand/ScreenState";
import { MatchTalk } from "@/components/match/MatchTalk";
import { ResultModal } from "@/components/match/ResultModal";
import { ScoreBoard, marksForShooter } from "@/components/match/ScoreBoard";
import type { KickPlay } from "@/components/match/stadium/Scene";
import { useMatch } from "@/hooks/useMatch";
import { REGULATION_KICKS, type Zone } from "@/lib/constants";
import { choiceWindowMs } from "@/lib/game/window";
import type { KeeperPacket } from "@/lib/game/keeper-packet";
import { coverRadiusMilli, resolveAim, whyCopy, zoneFromMilliX, type AimPoint } from "@/lib/game/engine";
import { formatNaira } from "@/lib/format";
import { roomPayout } from "@/lib/market";
import {
  choiceWindowOpen,
  latestResolvedRound,
  matchPhase,
  myLockedChoice,
} from "@/lib/game/machine";
import { enterMatchFullscreen } from "@/lib/fullscreen";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PenaltyStadium = dynamic(
  () =>
    import("@/components/match/stadium/PenaltyStadium").then(
      (mod) => mod.PenaltyStadium,
    ),
  {
    ssr: false,
    loading: () => (
      <ScreenState loading body="Lighting the stadium." />
    ),
  },
);

export function MatchRoom({ matchId }: { matchId: string }) {
  const router = useRouter();
  const { view, error, submit, expire, forfeit, sendChat, sendTyping, oppTyping, chatError, user } = useMatch(matchId);
  const [busy, setBusy] = useState(false);
  const [choiceRoundId, setChoiceRoundId] = useState<string | null>(null);
  const [localChoice, setLocalChoice] = useState<Zone | null>(null);
  const [playedRound, setPlayedRound] = useState<string | null>(null);
  const [playbackRoundId, setPlaybackRoundId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rematchBusy, setRematchBusy] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const forfeitSent = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (view?.match.status === "active") {
      void enterMatchFullscreen();
    }
  }, [view?.match.status]);

  useEffect(() => {
    const status = view?.match.status;
    if (status === "completed" || status === "cancelled") {
      forfeitSent.current = true;
    }
  }, [view?.match.status]);

  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      const status = view?.match.status;
      if (forfeitSent.current) return;
      if (status !== "active") return;
      forfeitSent.current = true;
      void forfeit(true);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [forfeit, view?.match.status]);

  const lastResolved = useMemo(
    () => (view ? latestResolvedRound(view.rounds) : null),
    [view],
  );

  const skippedIntro = useRef(false);

  useEffect(() => {
    if (!view || skippedIntro.current) return;
    skippedIntro.current = true;
    if (view.match.status === "completed") {
      const last = latestResolvedRound(view.rounds);
      if (last) setPlayedRound(last.id);
    }
  }, [view]);

  useEffect(() => {
    if (!lastResolved || lastResolved.outcome === "pending") return;
    if (playedRound === lastResolved.id) return;
    setPlaybackRoundId(lastResolved.id);
  }, [lastResolved, playedRound]);

  const machine = view && user
    ? matchPhase({
        view,
        userId: user.id,
        playbackRoundId,
      })
    : null;

  const youAreA = user?.id === view?.match.player_a_id;
  const youName = youAreA
    ? view?.playerA.full_name ?? "You"
    : view?.playerB?.full_name ?? "You";
  const oppName = youAreA
    ? view?.playerB?.full_name ?? "Searching…"
    : view?.playerA.full_name ?? "Opponent";
  const youScore = youAreA
    ? (view?.match.player_a_score ?? 0)
    : (view?.match.player_b_score ?? 0);
  const oppScore = youAreA
    ? (view?.match.player_b_score ?? 0)
    : (view?.match.player_a_score ?? 0);

  const current = view?.currentRound;
  const lockedChoice =
    current && user ? myLockedChoice(current, user.id) : null;
  const selected =
    lockedChoice ?? (choiceRoundId === current?.id ? localChoice : null);
  const windowOpen = Boolean(current && choiceWindowOpen(current, now));
  const waitingForOpp = view?.match.status === "waiting";
  const complete = machine?.phase === "complete";
  const won = complete && view?.match.winner_id === user?.id;
  const role: "shooter" | "keeper" = current
    ? view?.isStriker
      ? "shooter"
      : "keeper"
    : (machine?.role ?? "shooter");
  const payout = view
    ? (view.escrow?.payout_amount ?? roomPayout(view.match.stake_amount))
    : 0;

  const play = useMemo<KickPlay | null>(() => {
    if (!view || !lastResolved || lastResolved.id !== playbackRoundId) return null;
    if (lastResolved.outcome === "pending") return null;
    const resolved = resolveAim(
      lastResolved.shooter_x != null && lastResolved.shooter_y != null
        ? { x: lastResolved.shooter_x, y: lastResolved.shooter_y }
        : null,
      lastResolved.keeper_x != null && lastResolved.keeper_y != null
        ? { x: lastResolved.keeper_x, y: lastResolved.keeper_y }
        : null,
      lastResolved.shooter_accuracy ?? 0,
      lastResolved.keeper_accuracy ?? 0,
    );
    return {
      roundId: lastResolved.id,
      shooter: lastResolved.shooter_choice,
      keeper: lastResolved.keeper_choice,
      intentX: lastResolved.shooter_x,
      intentY: lastResolved.shooter_y,
      shotX: resolved.actual?.x ?? lastResolved.shooter_x,
      shotY: resolved.actual?.y ?? lastResolved.shooter_y,
      coverX: lastResolved.keeper_x,
      coverY: lastResolved.keeper_y,
      coverRadius: coverRadiusMilli(lastResolved.keeper_accuracy ?? 0),
      reason: whyCopy(resolved.why),
      outcome: lastResolved.outcome,
      finish: resolved.finish,
      kickAcc: lastResolved.shooter_accuracy ?? 0,
      kickIndex: lastResolved.round_number,
      wagerAmount: view.match.stake_amount,
    };
  }, [lastResolved, playbackRoundId, view]);

  const onExpire = useCallback(() => {
    void expire();
  }, [expire]);

  const onPlaybackEnd = useCallback(() => {
    if (!lastResolved || lastResolved.outcome === "pending") return;
    setPlayedRound(lastResolved.id);
    setPlaybackRoundId(null);
  }, [lastResolved]);

  const goHome = useCallback(() => {
    router.push("/home");
  }, [router]);

  const onExit = useCallback(() => {
    if (complete) {
      goHome();
      return;
    }
    setLeaveError(null);
    setLeaveOpen(true);
  }, [complete, goHome]);

  const confirmLeave = useCallback(async () => {
    if (leaveBusy) return;
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      forfeitSent.current = true;
      await forfeit();
      goHome();
    } catch (err) {
      forfeitSent.current = false;
      setLeaveError(err instanceof Error ? err.message : "Could not leave");
      setLeaveBusy(false);
    }
  }, [forfeit, goHome, leaveBusy]);

  async function onLock(aim: AimPoint, accuracy: number, packet?: KeeperPacket) {
    if (
      busy ||
      lockedChoice ||
      !current ||
      current.outcome !== "pending" ||
      !windowOpen ||
      Boolean(play)
    ) {
      return;
    }
    setLocalChoice(zoneFromMilliX(aim.x));
    setChoiceRoundId(current.id);
    setBusy(true);
    try {
      await submit(aim, accuracy, packet);
    } finally {
      setBusy(false);
    }
  }

  async function onRematch() {
    if (rematchBusy || !view || !user) return;
    setRematchError(null);
    setRematchBusy(true);
    const teamId = youAreA
      ? view.match.player_a_team
      : (view.match.player_b_team ?? user.team_id);
    try {
      const response = await fetch("/api/market", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stake: view.match.stake_amount,
          teamId,
        }),
      });
      const data = (await response.json()) as {
        match?: { id: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not start rematch");
      }
      if (data.match?.id) {
        router.push(`/match/${data.match.id}`);
        return;
      }
      router.push("/matches");
    } catch (err) {
      setRematchError(err instanceof Error ? err.message : "Could not start rematch");
      setRematchBusy(false);
    }
  }

  if (error) {
    return <ScreenState title="Signal lost" body={error} />;
  }

  if (!view || !user) {
    return <ScreenState loading body="Syncing the match." />;
  }

  if (waitingForOpp) {
    return (
      <>
        <ScreenState
          loading
          title="Waiting"
          body={`${formatNaira(view.match.stake_amount)} locked. Hunting a human — 3 minutes.`}
          action={
            <button
              type="button"
              onClick={onExit}
              className="mt-8 text-sm text-muted"
            >
              Cancel hunt
            </button>
          }
        />
        <LeaveSheet
          open={leaveOpen}
          busy={leaveBusy}
          error={leaveError}
          waiting
          stake={view.match.stake_amount}
          payout={payout}
          onStay={() => setLeaveOpen(false)}
          onLeave={() => void confirmLeave()}
        />
      </>
    );
  }

  const scoreboard = (
    <ScoreBoard
      youName={youName ?? "You"}
      oppName={oppName ?? "Opponent"}
      youScore={Number(view?.turn.score.split(":")[0] ?? youScore)}
      oppScore={Number(view?.turn.score.split(":")[1] ?? oppScore)}
      stake={view.match.stake_amount}
      round={view.turn.kick}
      phaseLabel={
        complete
          ? "Final"
          : `Round ${view.turn.round} · Kick ${view.turn.kick}`
      }
      suddenDeath={view.match.current_round > REGULATION_KICKS}
      complete={complete}
      youMarks={marksForShooter(view.rounds, user.id, view.match.current_round)}
      oppMarks={marksForShooter(
        view.rounds,
        youAreA ? (view.playerB?.id ?? "") : view.playerA.id,
        view.match.current_round,
      )}
      youTeamId={youAreA ? view.match.player_a_team : view.match.player_b_team}
      oppTeamId={youAreA ? view.match.player_b_team : view.match.player_a_team}
      closesAt={
        role === "shooter" &&
        machine?.phase === "choosing" &&
        windowOpen &&
        current
          ? current.choice_closes_at
          : null
      }
      windowMs={choiceWindowMs("shooter")}
      onExpire={onExpire}
      onExit={onExit}
    />
  );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-oled">
      <PenaltyStadium
        role={role}
        selected={selected}
        locked={machine?.phase === "locked"}
        disabled={
          busy ||
          machine?.phase !== "choosing" ||
          !windowOpen ||
          current?.outcome !== "pending"
        }
        play={play}
        runup={
          view.kickerLocked && view.runupX != null && view.runupY != null
            ? { x: view.runupX, y: view.runupY }
            : null
        }
        status={
          machine?.phase === "locked" && role === "keeper" && !view.kickerLocked
            ? "Wait for the strike"
            : machine?.phase === "locked" && role === "shooter"
              ? "Waiting for the dive"
            : machine?.phase === "locked"
              ? "Waiting for the whistle"
            : role === "keeper" && view.kickerLocked
                ? "Read the plant"
                : !windowOpen && machine?.phase === "choosing"
                  ? "Switching sides…"
                  : null
        }
        header={
          <div className="w-full">
            {scoreboard}
            {view.humanDuel ? (
              <MatchTalk
                youId={user.id}
                oppName={oppName}
                oppHere={view.oppHere}
                oppTyping={oppTyping}
                messages={view.chat ?? []}
                hidden={complete && !play}
                mustPlay={
                  Boolean(play) ||
                  (role === "shooter" &&
                    machine?.phase === "choosing" &&
                    windowOpen) ||
                  (role === "keeper" && view.kickerLocked)
                }
                chatError={chatError}
                onSend={sendChat}
                onTyping={sendTyping}
              />
            ) : null}
          </div>
        }
        shooterTeamId={
          (current ?? lastResolved)?.shooter_id === view.match.player_a_id
            ? view.match.player_a_team
            : view.match.player_b_team
        }
        keeperTeamId={
          (current ?? lastResolved)?.keeper_id === view.match.player_a_id
            ? view.match.player_a_team
            : view.match.player_b_team
        }
        shooterSeat={
          (current ?? lastResolved)?.shooter_id === view.match.player_a_id
            ? "a"
            : "b"
        }
        onLock={(aim, accuracy, packet) => void onLock(aim, accuracy, packet)}
        onReactTimeout={onExpire}
        onPlaybackEnd={onPlaybackEnd}
      />
      <ResultModal
        open={complete && !play}
        won={Boolean(won)}
        payout={payout}
        youScore={youScore}
        oppScore={oppScore}
        rematchPending={rematchBusy}
        rematchError={rematchError}
        onLobby={goHome}
        onRematch={() => void onRematch()}
      />
      <LeaveSheet
        open={leaveOpen}
        busy={leaveBusy}
        error={leaveError}
        waiting={false}
        stake={view.match.stake_amount}
        payout={payout}
        onStay={() => setLeaveOpen(false)}
        onLeave={() => void confirmLeave()}
      />
    </div>
  );
}

function LeaveSheet({
  open,
  busy,
  error,
  waiting,
  stake,
  payout,
  onStay,
  onLeave,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  waiting: boolean;
  stake: number;
  payout: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Stay in match"
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={busy ? undefined : onStay}
          />
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className="glass relative z-[1] mx-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] w-[min(26rem,calc(100%-1.5rem))] rounded-[1.5rem] px-5 py-5"
          >
            <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
              {waiting ? "Cancel hunt" : "Leave match"}
            </p>
            <h2 className="font-display mt-1 text-4xl leading-none text-silver">
              {waiting ? "Refund stake?" : "Leave and you lose"}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {waiting
                ? `${formatNaira(stake)} returns to your wallet. No rival, no result.`
                : `Walk out now and the match is a loss. Your rival takes ${formatNaira(payout)} · 90%. Closing the app counts the same.`}
            </p>
            {error ? (
              <p className="mt-3 text-sm text-danger">{error}</p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onStay}
                className="btn-ghost h-12 rounded-2xl text-sm font-semibold"
              >
                Stay
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onLeave}
                className="h-12 rounded-2xl bg-danger text-sm font-bold text-white"
              >
                {busy
                  ? "Leaving…"
                  : waiting
                    ? "Refund me"
                    : "I lose"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
