"use client";

import { GoalAimPad } from "@/components/match/GoalAimPad";
import { NeonFuse } from "@/components/match/NeonFuse";
import { OutcomeFlash } from "@/components/match/OutcomeFlash";
import { StadiumScene, FIFA_PK_CAM, FIFA_PK_FOV, type KickPlay } from "@/components/match/stadium/Scene";
import { useShrinkingTarget } from "@/hooks/useShrinkingTarget";
import { useReactStopwatch } from "@/hooks/useReactStopwatch";
import { KEEPER_REACT_MS, OLED, type Zone } from "@/lib/constants";
import {
  executionScoreForElapsed,
  type KeeperPacket,
} from "@/lib/game/keeper-packet";
import { formatPrecision, accuracyFromScale } from "@/lib/game/shrinking-target";
import { zoneFromMilliX, type AimPoint } from "@/lib/game/engine";
import { startAmbience, stopAmbience, triggerHaptic, unlockAudio } from "@/lib/soundManager";
import { type ShooterSeat } from "@/components/match/stadium/Player";
import { type TeamId } from "@/lib/teams";
import { Canvas } from "@react-three/fiber";
import {
  type MutableRefObject,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

function LivePrecision({
  role,
  liveScale,
}: {
  role: "shooter" | "keeper";
  liveScale: MutableRefObject<number>;
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      setPct(Math.round(accuracyFromScale(liveScale.current)));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [liveScale]);
  return (
    <p className="sk-target-readout" data-role={role} data-live="true">
      {formatPrecision(role, pct)}
    </p>
  );
}

export type CameraEffect = "idle" | "shake" | "zoom-goal" | "zoom-save";

const EFFECT_CLASS: Record<CameraEffect, string> = {
  idle: "scale-100",
  shake: "animate-cam-shake scale-100",
  "zoom-goal": "scale-[1.05]",
  "zoom-save": "scale-[0.97]",
};

export function PenaltyStadium({
  role,
  selected,
  locked,
  disabled,
  play,
  status,
  header,
  shooterTeamId,
  keeperTeamId,
  shooterSeat,
  cameraEffect: cameraEffectProp,
  runup,
  onLock,
  onPlaybackEnd,
  onReactTimeout,
}: {
  role: "shooter" | "keeper";
  selected: Zone | null;
  locked: boolean;
  disabled: boolean;
  play: KickPlay | null;
  status?: string | null;
  header?: ReactNode;
  shooterTeamId?: TeamId | null;
  keeperTeamId?: TeamId | null;
  shooterSeat?: ShooterSeat;
  cameraEffect?: CameraEffect;
  runup?: { x: number; y: number } | null;
  onLock: (aim: AimPoint, accuracy: number, packet?: KeeperPacket) => void;
  onPlaybackEnd: () => void;
  onReactTimeout?: () => void;
}) {
  const watching = Boolean(play);
  const canAim = !disabled && !locked && !watching;
  const isGoalKeeper = role === "keeper";
  const reactArmed = isGoalKeeper && canAim && Boolean(runup);
  const [internalEffect, setInternalEffect] = useState<CameraEffect>("idle");
  const [sting, setSting] = useState<"goal" | "saved" | null>(null);
  const timers = useRef<number[]>([]);
  const stingTimer = useRef<number | null>(null);
  const cameraEffect = cameraEffectProp ?? internalEffect;
  const elapsedRef = useRef(0);
  const aimLive = useRef<AimPoint | null>(null);
  const lockedRef = useRef(false);

  const handleFreeze = useCallback(
    (aim: AimPoint, freezeScore: number) => {
      if (lockedRef.current) return;
      if (isGoalKeeper) {
        const timeElapsed = elapsedRef.current;
        const executionScore = executionScoreForElapsed(
          timeElapsed,
          freezeScore,
        );
        lockedRef.current = true;
        onLock(aim, executionScore, {
          x: aim.x,
          y: aim.y,
          timeElapsed,
          executionScore,
        });
        return;
      }
      lockedRef.current = true;
      onLock(aim, freezeScore);
    },
    [isGoalKeeper, onLock],
  );

  const target = useShrinkingTarget({
    enabled: canAim,
    mode: isGoalKeeper ? "stretch" : "shrink",
    onLock: handleFreeze,
  });
  aimLive.current = target.aim;

  useEffect(() => {
    if (!canAim) lockedRef.current = false;
  }, [canAim]);

  const fuse = useReactStopwatch({
    active: reactArmed,
    durationMs: KEEPER_REACT_MS,
    onExpire: () => {
      if (lockedRef.current) return;
      const aim = aimLive.current;
      if (aim) {
        handleFreeze(aim, 0);
        return;
      }
      lockedRef.current = true;
      onReactTimeout?.();
    },
  });
  elapsedRef.current = fuse.elapsed;

  const selectedZone =
    target.aim ? zoneFromMilliX(target.aim.x) : selected;

  const clearEffectTimers = useCallback(() => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  }, []);

  const onContact = useCallback(() => {
    if (cameraEffectProp) return;
    triggerHaptic("heavy");
    setInternalEffect("shake");
  }, [cameraEffectProp]);

  const onKickResolved = useCallback(
    (outcome: "goal" | "saved") => {
      setSting(outcome);
      triggerHaptic(outcome === "goal" ? "success" : "heavy");
      if (stingTimer.current) window.clearTimeout(stingTimer.current);
      stingTimer.current = window.setTimeout(() => {
        setSting(null);
        stingTimer.current = null;
      }, 2100);

      if (cameraEffectProp) return;
      clearEffectTimers();
      const zoomId = window.setTimeout(() => {
        setInternalEffect(outcome === "goal" ? "zoom-goal" : "zoom-save");
      }, 80);
      const idleId = window.setTimeout(() => {
        setInternalEffect("idle");
      }, 1600);
      timers.current = [zoomId, idleId];
    },
    [cameraEffectProp, clearEffectTimers],
  );

  useEffect(() => () => {
    clearEffectTimers();
    if (stingTimer.current) window.clearTimeout(stingTimer.current);
  }, [clearEffectTimers]);

  useEffect(() => {
    startAmbience();
    return () => stopAmbience();
  }, []);

  useEffect(() => {
    if (watching) target.reset();
  }, [target.reset, watching]);

  useEffect(() => {
    if (play) return;
    clearEffectTimers();
    setInternalEffect("idle");
  }, [play, clearEffectTimers]);

  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-oled"
      onPointerDown={() => {
        unlockAudio();
        startAmbience();
      }}
    >
      <div
        className={`absolute inset-x-0 top-0 bottom-[6.9rem] origin-center will-change-transform ${
          cameraEffect === "shake"
            ? ""
            : "transition-transform duration-500 ease-out"
        } ${EFFECT_CLASS[cameraEffect]}`}
      >
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            position: [FIFA_PK_CAM.x, FIFA_PK_CAM.y, FIFA_PK_CAM.z],
            fov: FIFA_PK_FOV,
            near: 0.1,
            far: 140,
          }}
          gl={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.autoClear = true;
            gl.autoClearColor = true;
            gl.autoClearDepth = true;
            gl.setClearColor(OLED, 1);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.32;
          }}
        >
          <Suspense fallback={null}>
            <StadiumScene
              selected={play?.shooter ?? selectedZone}
              play={play}
              role={role}
              shooterTeamId={shooterTeamId}
              keeperTeamId={keeperTeamId}
              shooterSeat={shooterSeat}
              targetAim={target.aim}
              targetPhase={target.phase}
              targetLock={target.lock}
              targetShock={target.shock}
              ringRef={target.ringRef}
              runup={runup ?? null}
              fuseRemainMs={reactArmed ? fuse.remain : undefined}
              onPlaybackEnd={onPlaybackEnd}
              onKickResolved={onKickResolved}
              onContact={onContact}
            />
          </Suspense>
        </Canvas>
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[15] transition-opacity duration-500 ${
          cameraEffect === "zoom-goal"
            ? "bg-amber-300/10 opacity-100"
            : cameraEffect === "zoom-save"
              ? "bg-sky-400/10 opacity-100"
              : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[25] transition-[box-shadow,opacity] duration-500 ${
          cameraEffect === "zoom-goal"
            ? "opacity-100 shadow-[inset_0_0_0_2px_rgba(232,197,71,0.85),inset_0_0_64px_rgba(232,197,71,0.28)]"
            : cameraEffect === "zoom-save"
              ? "opacity-100 shadow-[inset_0_0_0_2px_rgba(186,220,255,0.7),inset_0_0_64px_rgba(90,168,255,0.28)]"
              : "opacity-0 shadow-none"
        }`}
      />

      {target.phase === "shrinking" && canAim ? (
        <LivePrecision role={role} liveScale={target.liveScale} />
      ) : target.lock && !watching ? (
        <p
          className="sk-target-readout"
          data-role={role}
        >
          {formatPrecision(role, target.lock.accuracy)}
        </p>
      ) : null}

      <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/35 to-transparent pt-[env(safe-area-inset-top)]">
        <div className="px-3 pb-2 pt-1.5">
          {header}
          {watching ? (
            <p className="mt-1.5 text-center text-[10px] font-semibold tracking-[0.16em] text-white/70 uppercase">
              {play?.reason ?? "Strike"}
            </p>
          ) : null}
          {status && !watching ? (
            <p className="mt-1.5 text-center text-[11px] font-semibold text-white/80">
              {status}
            </p>
          ) : null}
          {reactArmed ? (
            <NeonFuse remainMs={fuse.remain} windowMs={KEEPER_REACT_MS} />
          ) : null}
          {locked && !watching && !status ? (
            <p className="mt-1.5 text-center text-[11px] font-semibold text-[#00FF66]">
              Locked — waiting for the whistle
            </p>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-oled/80 via-oled/20 to-transparent px-3 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <p className="sk-timed">
          {watching
            ? play?.reason ?? "Replay"
            : isGoalKeeper
              ? runup
                ? "Read the plant · freeze to stretch the disc"
                : "Wait for the strike"
              : "Place the shot · freeze to hit the point"}
        </p>
        <GoalAimPad
          role={role}
          aim={target.aim}
          phase={target.phase}
          lock={target.lock}
          disabled={!canAim}
          liveScale={target.liveScale}
          react={reactArmed}
          remainMs={reactArmed ? fuse.remain : undefined}
          onPointerDown={target.onPointerDown}
          onPointerMove={target.onPointerMove}
          onPointerUp={target.onPointerUp}
        />
      </div>
      <OutcomeFlash value={sting} role={role} reason={play?.reason} />
    </div>
  );
}