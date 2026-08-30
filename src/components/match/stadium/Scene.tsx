"use client";

import { type Zone } from "@/lib/constants";
import type { KickFinish } from "@/lib/game/engine";
import { playCheer, playGlove, playKick, playNet, playPlant, playWhoosh, playWhistle, playWide, triggerHaptic } from "@/lib/soundManager";
import { type TeamId } from "@/lib/teams";
import {
  PhotoPlayer,
  shooterPalette,
  type PlayerHandle,
  type PlayerPose,
  type ShooterSeat,
} from "@/components/match/stadium/Player";
import {
  Goal,
  MatchAtmosphere,
  Pitch,
  StadiumBowl,
  ZONE_X,
  ZONE_Y,
  GOAL_HALF_W,
  GOAL_H,
  goalWorldFromMilli,
} from "@/components/match/stadium/World";
import { ShrinkingTargetRing } from "@/components/match/ShrinkingTargetRing";
import { type TargetLock, type TargetPhase } from "@/hooks/useShrinkingTarget";
import {
  ContactShadows,
  Environment,
  useTexture,
} from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  SMAA,
  Vignette,
} from "@react-three/postprocessing";
import { type RefCallback, useRef } from "react";
import * as THREE from "three";

export type KickPlay = {
  roundId: string;
  shooter: Zone | null;
  keeper: Zone | null;
  intentX?: number | null;
  intentY?: number | null;
  shotX?: number | null;
  shotY?: number | null;
  coverX?: number | null;
  coverY?: number | null;
  coverRadius?: number | null;
  reason?: string;
  outcome: "goal" | "saved";
  finish?: KickFinish;
  kickAcc?: number;
  kickIndex?: number;
  wagerAmount?: number;
};

const BALL_START = new THREE.Vector3(0, 0.11, 0.15);
const KEEPER_Z = -10.15;
const SHOOTER_MARK = new THREE.Vector3(0.22, 0, 6.45);
const SHOOTER_PLANT = new THREE.Vector3(0.2, 0, 0.5);
const SHOOTER_THROUGH = new THREE.Vector3(0.14, 0, 0.22);
const RUN_END = 0.82;
const FLIGHT_DUR = 0.62;
const CONTACT_RADIUS_SQ = 0.4 * 0.4;
const TRAIL_N = 10;
const _ballWorld = new THREE.Vector3();

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}
function smooth(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function shooterPoseAt(elapsed: number, runEnd: number): PlayerPose {
  if (elapsed < 0.07) return "idle";
  if (elapsed < runEnd - 0.12) return "run";
  if (elapsed < runEnd) return "plant";
  if (elapsed < runEnd + 0.1) return "kick";
  if (elapsed < runEnd + 0.26) return "contact";
  return "follow";
}

function flightSample(
  play: KickPlay,
  u: number,
): { x: number; y: number; z: number } {
  const saved = play.outcome === "saved";
  const wide = play.finish === "wide";
  const acc = play.kickAcc ?? 100;
  const world =
    play.shotX != null && play.shotY != null
      ? goalWorldFromMilli(play.shotX, play.shotY)
      : play.shooter
        ? { x: ZONE_X[play.shooter], y: ZONE_Y[play.shooter], z: 0 }
        : null;
  if (!world) {
    return { x: BALL_START.x, y: BALL_START.y, z: BALL_START.z };
  }
  const targetX = wide ? world.x * 1.28 : world.x;
  const endZ = wide ? -10.35 : saved ? -9.96 : -11.42;
  const endY = wide
    ? Math.max(0.16, world.y * 0.38)
    : saved
      ? Math.min(world.y, 1.68)
      : world.y;
  const apex = saved ? 0.3 : world.y > 1.55 ? 1.22 : 0.44;
  const knuckle = ((100 - acc) / 100) * 0.3;
  const bend = targetX < -1 ? 0.15 : targetX > 1 ? -0.15 : 0;
  const s = smooth(u);
  const dip = Math.sin(u * Math.PI);
  return {
    x:
      lerp(0, targetX, s) +
      dip * (bend + knuckle * Math.sin(u * Math.PI * 2.05)) * (1 - u),
    y:
      lerp(0.11, endY, u) +
      dip * apex * (1 - u * 0.18) -
      knuckle * u * u * 0.32,
    z: lerp(0.15, endZ, s),
  };
}

export const FIFA_PK_CAM = new THREE.Vector3(0, 3.28, 16.85);
export const FIFA_PK_LOOK = new THREE.Vector3(0, 1.2, -10.65);
export const FIFA_PK_FOV = 34;

export function StadiumScene({
  selected,
  play,
  role,
  shooterTeamId,
  keeperTeamId,
  shooterSeat,
  targetAim,
  targetPhase,
  targetLock,
  targetShock,
  ringRef,
  runup,
  fuseRemainMs,
  onPlaybackEnd,
  onKickResolved,
  onContact,
}: {
  selected: Zone | null;
  play: KickPlay | null;
  role: "shooter" | "keeper";
  shooterTeamId?: TeamId | null;
  keeperTeamId?: TeamId | null;
  shooterSeat?: ShooterSeat;
  targetAim?: { x: number; y: number } | null;
  targetPhase?: TargetPhase;
  targetLock?: TargetLock | null;
  targetShock?: boolean;
  ringRef?: RefCallback<SVGGElement>;
  runup?: { x: number; y: number } | null;
  fuseRemainMs?: number;
  onPlaybackEnd: () => void;
  onKickResolved: (outcome: "goal" | "saved") => void;
  onContact?: () => void;
}) {
  const netPulse = useRef(0);
  const camPunch = useRef(0);
  const ballFollow = useRef(FIFA_PK_LOOK.clone());
  const followAmt = useRef(0);
  return (
    <>
      <MatchAtmosphere />
      <Environment preset="night" environmentIntensity={0.48} />
      <CameraRig punch={camPunch} follow={ballFollow} followAmt={followAmt} />
      <StadiumBowl />
      <Pitch />
      <Goal selected={selected} pulse={netPulse} />
      {ringRef && targetPhase && targetPhase !== "idle" && !play ? (
        <ShrinkingTargetRing
          role={role}
          aim={targetAim ?? null}
          phase={targetPhase}
          lock={targetLock ?? null}
          shock={Boolean(targetShock)}
          ringRef={ringRef}
          remainMs={fuseRemainMs}
        />
      ) : null}
      <KickDirector
        play={play}
        runup={runup ?? null}
        shooterTeamId={shooterTeamId}
        keeperTeamId={keeperTeamId}
        shooterSeat={shooterSeat}
        netPulse={netPulse}
        camPunch={camPunch}
        ballFollow={ballFollow}
        followAmt={followAmt}
        onPlaybackEnd={onPlaybackEnd}
        onKickResolved={onKickResolved}
        onContact={onContact}
      />
      <ContactShadows
        position={[0, 0.02, -2]}
        opacity={0.74}
        scale={28}
        blur={1.45}
        far={9}
        resolution={1024}
        color="#05070c"
      />
      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom intensity={0.38} luminanceThreshold={0.68} mipmapBlur />
        <BrightnessContrast brightness={0.02} contrast={0.22} />
        <Vignette darkness={0.42} offset={0.22} />
        <SMAA />
      </EffectComposer>
    </>
  );
}

const _camLook = new THREE.Vector3();
const _camFollow = new THREE.Vector3();

function CameraRig({
  punch,
  follow,
  followAmt,
}: {
  punch: { current: number };
  follow: { current: THREE.Vector3 };
  followAmt: { current: number };
}) {
  const look = useRef(FIFA_PK_LOOK.clone());
  useFrame(({ camera }, delta) => {
    punch.current = Math.max(0, punch.current - delta * 2.85);
    const p = punch.current * punch.current;
    const settle = 1 - Math.pow(0.0004, delta);
    camera.position.lerp(FIFA_PK_CAM, settle);
    camera.position.y += p * 0.05;
    camera.position.z -= p * 0.28;
    look.current.lerp(FIFA_PK_LOOK, settle);
    const track = followAmt.current;
    if (track > 0.02) {
      _camFollow.copy(follow.current);
      _camLook.lerpVectors(look.current, _camFollow, track * 0.2);
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        follow.current.x * 0.07,
        settle * 0.45,
      );
    } else {
      _camLook.copy(look.current);
    }
    _camLook.y -= p * 0.08;
    camera.lookAt(_camLook);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = THREE.MathUtils.lerp(
      perspective.fov,
      FIFA_PK_FOV - p * 1.7,
      settle,
    );
    perspective.updateProjectionMatrix();
  });
  return null;
}

function KickDirector({
  play,
  runup,
  shooterTeamId,
  keeperTeamId,
  shooterSeat,
  netPulse,
  camPunch,
  ballFollow,
  followAmt,
  onPlaybackEnd,
  onKickResolved,
  onContact,
}: {
  play: KickPlay | null;
  runup?: { x: number; y: number } | null;
  shooterTeamId?: TeamId | null;
  keeperTeamId?: TeamId | null;
  shooterSeat?: ShooterSeat;
  netPulse: { current: number };
  camPunch: { current: number };
  ballFollow: { current: THREE.Vector3 };
  followAmt: { current: number };
  onPlaybackEnd: () => void;
  onKickResolved: (outcome: "goal" | "saved") => void;
  onContact?: () => void;
}) {
  const shooter = useRef<PlayerHandle>(null);
  const keeper = useRef<PlayerHandle>(null);
  const ball = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const spray = useRef<THREE.Points>(null);
  const ring = useRef<THREE.Mesh>(null);
  const netFlash = useRef<THREE.Mesh>(null);
  const ghosts = useRef<(THREE.Mesh | null)[]>(Array.from({ length: TRAIL_N }, () => null));
  const startedAt = useRef<number | null>(null);
  const ended = useRef(false);
  const shooterClip = useRef<PlayerPose>("idle");
  const keeperClip = useRef<PlayerPose>("idle");
  const roundTracker = play?.kickIndex ?? 0;
  const kickIndex = play?.kickIndex ?? 0;
  const wagerAmount = play?.wagerAmount ?? 0;
  const playKey = play
    ? `${play.roundId}:${kickIndex}:${wagerAmount}:${roundTracker}`
    : "";
  const lastKey = useRef("");
  const whistleCue = useRef(false);
  const whooshCue = useRef(false);
  const kickCue = useRef(false);
  const contactCue = useRef(false);
  const contactAt = useRef<number | null>(null);
  const resolvedCue = useRef(false);
  const netCue = useRef(false);
  const gloveCue = useRef(false);
  const cheerCue = useRef(false);
  const plantCue = useRef(false);
  const approachAt = useRef<number | null>(null);
  const runFrom = useRef(SHOOTER_MARK.clone());
  const runDur = useRef(RUN_END);
  const ballMap = useTexture("/textures/football.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
  });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const sRoot = shooter.current?.root;
    const kRoot = keeper.current?.root;
    netPulse.current = Math.max(0, netPulse.current - delta * 0.95);

    if (lastKey.current !== playKey) {
      lastKey.current = playKey;
      startedAt.current = null;
      ended.current = false;
      camPunch.current = 0;
      shooterClip.current = "idle";
      keeperClip.current = "idle";
      shooter.current?.setPose("idle");
      keeper.current?.setPose("idle");
      if (sRoot) runFrom.current.copy(sRoot.position);
      else runFrom.current.copy(SHOOTER_MARK);
      runDur.current = Math.max(
        0.18,
        Math.min(1.05, (runFrom.current.z - SHOOTER_PLANT.z) * 0.165),
      );
      approachAt.current = null;
      if (kRoot) kRoot.position.set(0, 0, KEEPER_Z);
      if (ball.current) {
        ball.current.position.copy(BALL_START);
        ball.current.scale.set(1, 1, 1);
      }
      followAmt.current = 0;
      ballFollow.current.copy(FIFA_PK_LOOK);
      whistleCue.current = false;
      whooshCue.current = false;
      kickCue.current = false;
      contactCue.current = false;
      contactAt.current = null;
      resolvedCue.current = false;
      netCue.current = false;
      gloveCue.current = false;
      cheerCue.current = false;
      plantCue.current = false;
      for (const ghost of ghosts.current) {
        if (!ghost) continue;
        ghost.visible = false;
        ghost.position.copy(BALL_START);
      }
      if (ring.current) ring.current.scale.setScalar(0);
      if (netFlash.current) netFlash.current.scale.setScalar(0);
    }

    if (!play) {
      const reading = Boolean(runup);
      if (reading) {
        if (!plantCue.current) {
          plantCue.current = true;
          playWhoosh();
        }
        if (approachAt.current === null) approachAt.current = t;
        const arrive = smooth(clamp01((t - approachAt.current) / 0.95));
        const nextClip: PlayerPose = arrive < 0.82 ? "run" : "plant";
        if (shooterClip.current !== nextClip) {
          shooterClip.current = nextClip;
          shooter.current?.setPose(nextClip);
          if (nextClip === "plant") {
            queueMicrotask(() => {
              playPlant();
              triggerHaptic("plant");
            });
          }
        }
        shooter.current?.drive(t, true, 0.55, delta);
        if (sRoot) {
          const lean = (runup!.x / 1000) * GOAL_HALF_W * 0.22;
          sRoot.position.lerpVectors(SHOOTER_MARK, SHOOTER_PLANT, arrive);
          sRoot.position.x += lean;
        }
      } else {
        plantCue.current = false;
        approachAt.current = null;
        if (shooterClip.current !== "idle") {
          shooterClip.current = "idle";
          shooter.current?.setPose("idle");
        }
        shooter.current?.drive(t, false, 0, delta);
        if (sRoot) sRoot.position.copy(SHOOTER_MARK);
      }
      if (keeperClip.current !== "idle") {
        keeperClip.current = "idle";
        keeper.current?.setPose("idle");
      }
      keeper.current?.drive(t, reading, reading ? 0.45 : 0, delta);
      if (kRoot) {
        const shuffle = reading
          ? (runup!.x / 1000) * GOAL_HALF_W * 0.38
          : Math.sin(t * 1.15) * 0.18;
        kRoot.position.x = THREE.MathUtils.damp(
          kRoot.position.x,
          shuffle,
          reading ? 5.5 : 3.2,
          delta,
        );
        kRoot.position.y = 0;
        kRoot.position.z = KEEPER_Z;
      }
      if (ball.current) {
        ball.current.position.copy(BALL_START);
        ball.current.rotation.x += delta * 0.35;
        ball.current.scale.set(1, 1, 1);
      }
      followAmt.current = 0;
      if (flash.current) flash.current.scale.setScalar(0);
      if (ring.current) ring.current.scale.setScalar(0);
      if (spray.current) spray.current.visible = false;
      for (const ghost of ghosts.current) {
        if (ghost) ghost.visible = false;
      }
      return;
    }

    if (startedAt.current === null) startedAt.current = t;
    const elapsed = t - startedAt.current;
    if (!whistleCue.current) {
      whistleCue.current = true;
      queueMicrotask(() => playWhistle());
    }

    const missedShot = play.shotX == null && play.shooter === null;
    const openNet = play.coverX == null && play.keeper === null;
    const diveX =
      play.coverX != null
        ? (play.coverX / 1000) * GOAL_HALF_W
        : play.keeper
          ? ZONE_X[play.keeper]
          : 0;
    const diveSide =
      diveX < -0.9 ? "left" : diveX > 0.9 ? "right" : "center";
    const saved = play.outcome === "saved";
    const runEnd = runDur.current;
    const kickAt = Math.max(0.12, runEnd - 0.06);
    const contactGate = runEnd + 0.08;
    const diveAt = Math.max(0.12, runEnd - 0.04);
    const plantT = smooth(clamp01(elapsed / runEnd));

    let struck = contactCue.current;
    if (
      !missedShot &&
      !struck &&
      elapsed >= kickAt &&
      ball.current &&
      shooter.current
    ) {
      ball.current.getWorldPosition(_ballWorld);
      if (
        elapsed >= contactGate ||
        shooter.current.footWorld.distanceToSquared(_ballWorld) <=
          CONTACT_RADIUS_SQ
      ) {
        struck = true;
      }
    }
    if (struck && !contactCue.current) {
      contactCue.current = true;
      contactAt.current = elapsed;
      kickCue.current = true;
      camPunch.current = 1;
      queueMicrotask(() => {
        playKick();
        onContact?.();
      });
    }

    if (sRoot) {
      if (missedShot) {
        sRoot.position.copy(SHOOTER_MARK);
        if (shooterClip.current !== "idle") {
          shooterClip.current = "idle";
          shooter.current?.setPose("idle");
        }
        shooter.current?.drive(elapsed, false, 0, delta);
      } else {
        if (elapsed <= runEnd) {
          sRoot.position.lerpVectors(runFrom.current, SHOOTER_PLANT, plantT);
        } else {
          const follow = smooth(clamp01((elapsed - runEnd) / 0.22));
          sRoot.position.lerpVectors(SHOOTER_PLANT, SHOOTER_THROUGH, follow);
        }
        const hitAt = contactAt.current ?? contactGate;
        const nextClip: PlayerPose = contactCue.current
          ? elapsed < hitAt + 0.16
            ? "contact"
            : "follow"
          : shooterPoseAt(elapsed, runEnd);
        if (shooterClip.current !== nextClip) {
          shooterClip.current = nextClip;
          shooter.current?.setPose(nextClip);
          if (nextClip === "plant") {
            queueMicrotask(() => {
              playPlant();
              triggerHaptic("plant");
            });
          }
        }
        const swing = elapsed < 0.08 ? 0 : clamp01((elapsed - 0.08) / Math.max(0.22, runEnd));
        shooter.current?.drive(elapsed, true, swing, delta);
      }
    }

    if (
      !missedShot &&
      (shooterClip.current === "run" ||
        shooterClip.current === "plant" ||
        shooterClip.current === "kick") &&
      !whooshCue.current
    ) {
      whooshCue.current = true;
      queueMicrotask(() => playWhoosh());
    }

    const hitAt = contactAt.current ?? contactGate;
    const resolveAt = missedShot ? 1.05 : hitAt + FLIGHT_DUR;

    if (elapsed >= resolveAt && !resolvedCue.current) {
      resolvedCue.current = true;
      const outcome = play.outcome;
      if (missedShot && !gloveCue.current) {
        gloveCue.current = true;
        queueMicrotask(() => playWide());
      }
      queueMicrotask(() => onKickResolved(outcome));
    }

    if (kRoot) {
      const diveT = 1 - Math.pow(1 - clamp01((elapsed - diveAt) / 0.34), 2.4);
      if (openNet || elapsed < diveAt) {
        kRoot.position.set(
          openNet ? 0 : Math.sin(t * 1.55) * 0.1,
          0,
          KEEPER_Z,
        );
        if (keeperClip.current !== "idle") {
          keeperClip.current = "idle";
          keeper.current?.setPose("idle");
        }
      } else {
        const nextKeeper: PlayerPose =
          diveSide === "center"
            ? "jump"
            : diveSide === "right"
              ? "dive-right"
              : "dive-left";
        if (keeperClip.current !== nextKeeper) {
          keeperClip.current = nextKeeper;
          keeper.current?.setPose(nextKeeper);
        }
        const aimX = diveSide === "center" ? 0 : diveX;
        const up =
          diveSide === "center"
            ? saved
              ? 1.28
              : 1.08
            : saved
              ? 1.62
              : 0.78;
        const drop = Math.max(0, elapsed - (resolveAt + 0.28)) * 1.15;
        kRoot.position.set(
          lerp(0, aimX, diveT),
          Math.max(0, lerp(0, up, diveT) - drop),
          KEEPER_Z,
        );
      }
      keeper.current?.drive(elapsed, true, openNet ? 0 : diveT, delta);
    }

    if (ball.current) {
      if (!contactCue.current) {
        ball.current.position.copy(BALL_START);
        ball.current.scale.set(1, 1, 1);
        followAmt.current = 0;
        for (const ghost of ghosts.current) {
          if (ghost) ghost.visible = false;
        }
      } else {
        const flight = clamp01((elapsed - hitAt) / FLIGHT_DUR);
        const sample = flightSample(play, flight);
        let { x, y, z } = sample;
        followAmt.current = Math.min(1, flight + 0.08);
        ballFollow.current.set(x, y, z);
        if (saved && flight >= 1) {
          const bounce = clamp01((elapsed - resolveAt) / 0.42);
          x = lerp(sample.x, sample.x * 0.18, bounce);
          y = Math.abs(Math.cos(bounce * Math.PI)) * 0.55 + 0.1;
          z = lerp(sample.z, -5.1, bounce);
        }
        if (!saved && flight >= 1) {
          const nest = clamp01((elapsed - resolveAt) / 0.22);
          z = lerp(sample.z, -12.48, nest);
          y = lerp(sample.y, sample.y * 0.74, nest);
          x = sample.x;
          if (nest > 0.02 && !netCue.current) {
            netCue.current = true;
            netPulse.current = 1;
            queueMicrotask(() => {
              playNet();
              if (!cheerCue.current) {
                cheerCue.current = true;
                playCheer();
              }
            });
          }
        }
        if (saved && flight >= 0.92 && !gloveCue.current) {
          gloveCue.current = true;
          const gloves = play.reason === "Inside the gloves";
          queueMicrotask(() => (gloves ? playGlove() : playWide()));
        }
        const squash = clamp01((elapsed - hitAt) / 0.08);
        const squashY = lerp(0.62, 1, squash);
        const squashX = lerp(1.28, 1, squash);
        const read = 1 + flight * 0.42;
        ball.current.scale.set(squashX * read, squashY * read, squashX * read);
        ball.current.position.set(x, y, z);
        ball.current.rotation.x += delta * 26 * (0.45 + flight);
        ball.current.rotation.z += delta * 11;

        for (let i = TRAIL_N - 1; i >= 1; i -= 1) {
          const prev = ghosts.current[i - 1];
          const next = ghosts.current[i];
          if (prev && next) {
            next.visible = true;
            next.position.copy(prev.position);
            next.scale.setScalar(0.82 - i * 0.055);
            const mat = next.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.42 * (1 - i / TRAIL_N);
          }
        }
        const head = ghosts.current[0];
        if (head) {
          head.visible = true;
          head.position.set(x, y, z);
          head.scale.setScalar(0.9);
          const mat = head.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.5;
        }
      }
    }

    if (flash.current) {
      if (contactCue.current && elapsed - hitAt < 0.16) {
        const pop = 1 - (elapsed - hitAt) / 0.16;
        flash.current.position.copy(ball.current?.position ?? BALL_START);
        flash.current.scale.setScalar(0.28 + pop * 1.15);
        const mat = flash.current.material as THREE.MeshBasicMaterial;
        mat.opacity = pop * 0.95;
      } else {
        flash.current.scale.setScalar(0);
      }
    }

    if (ring.current) {
      if (contactCue.current && elapsed - hitAt < 0.28) {
        const age = (elapsed - hitAt) / 0.28;
        ring.current.visible = true;
        ring.current.position.set(BALL_START.x, 0.03, BALL_START.z);
        ring.current.scale.setScalar(1 + age * 5.5);
        const mat = ring.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - age) * 0.7;
      } else {
        ring.current.visible = false;
        ring.current.scale.setScalar(0);
      }
    }

    if (netFlash.current) {
      if (netCue.current && elapsed - resolveAt < 0.35) {
        const age = clamp01((elapsed - resolveAt) / 0.35);
        netFlash.current.visible = true;
        netFlash.current.position.set(
          ball.current?.position.x ?? 0,
          ball.current?.position.y ?? 1.2,
          -11.35,
        );
        netFlash.current.scale.setScalar(0.6 + age * 2.4);
        const mat = netFlash.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - age) * 0.7;
      } else {
        netFlash.current.visible = false;
        netFlash.current.scale.setScalar(0);
      }
    }

    if (spray.current && contactCue.current) {
      const age = elapsed - hitAt;
      spray.current.visible = age < 0.42;
      spray.current.position.copy(BALL_START);
      spray.current.rotation.y += delta * 6;
    } else if (spray.current) {
      spray.current.visible = false;
    }

    if (elapsed > runEnd + 2.45 && !ended.current) {
      ended.current = true;
      queueMicrotask(onPlaybackEnd);
    }
  });

  const palette = shooterPalette(shooterTeamId, keeperTeamId, shooterSeat);
  const coverWorld =
    play && play.coverX != null && play.coverY != null
      ? goalWorldFromMilli(play.coverX, play.coverY)
      : null;
  const intentWorld =
    play && play.intentX != null && play.intentY != null
      ? goalWorldFromMilli(play.intentX, play.intentY)
      : null;
  const actualWorld =
    play && play.shotX != null && play.shotY != null
      ? goalWorldFromMilli(play.shotX, play.shotY)
      : null;
  const showIntent =
    Boolean(intentWorld && actualWorld) &&
    (play?.intentX !== play?.shotX || play?.intentY !== play?.shotY);

  return (
    <>
      <PhotoPlayer
        key={`shoot-${palette}`}
        ref={shooter}
        kit="shooter"
        palette={palette}
        position={[SHOOTER_MARK.x, SHOOTER_MARK.y, SHOOTER_MARK.z]}
        height={1.86}
      />
      <PhotoPlayer
        ref={keeper}
        kit="keeper"
        teamId={keeperTeamId}
        position={[0, 0, KEEPER_Z]}
        height={1.84}
      />
      {showIntent && intentWorld ? (
        <mesh position={[intentWorld.x, intentWorld.y, intentWorld.z]}>
          <ringGeometry args={[0.07, 0.11, 24]} />
          <meshBasicMaterial
            color="#f4fff0"
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {coverWorld && play?.coverRadius != null ? (
        <mesh
          position={[coverWorld.x, coverWorld.y, coverWorld.z]}
          scale={[GOAL_HALF_W / 1000, GOAL_H / 1000, 1]}
        >
          <circleGeometry args={[play.coverRadius, 48]} />
          <meshBasicMaterial
            color={play.outcome === "saved" ? "#5aa8ff" : "#e8c547"}
            transparent
            opacity={0.2}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      <mesh ref={ball} position={BALL_START} castShadow>
        <sphereGeometry args={[0.11, 48, 48]} />
        <meshPhysicalMaterial
          map={ballMap}
          roughness={0.22}
          metalness={0.08}
          clearcoat={0.72}
          clearcoatRoughness={0.18}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh ref={flash} scale={0}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial
          color="#fff4d2"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={ring}
        visible={false}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0.15]}
      >
        <ringGeometry args={[0.16, 0.28, 28]} />
        <meshBasicMaterial
          color="#e7ffc8"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={netFlash} visible={false} scale={0}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial
          color="#f4fff0"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: TRAIL_N }, (_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={(node) => {
            ghosts.current[i] = node;
          }}
          visible={false}
          scale={0.7}
        >
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshBasicMaterial
            color="#fff6dc"
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      ))}
      <points ref={spray} visible={false} position={BALL_START}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[sprayPositions(), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#c8e0b4"
          size={0.07}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>
    </>
  );
}

function sprayPositions() {
  const data = new Float32Array(36);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    data[i * 3] = Math.cos(a) * 0.18;
    data[i * 3 + 1] = 0.04 + (i % 3) * 0.05;
    data[i * 3 + 2] = Math.sin(a) * 0.12;
  }
  return data;
}
