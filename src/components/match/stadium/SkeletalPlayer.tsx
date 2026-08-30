"use client";

import { keeperKit, teamConfig } from "@/lib/teams";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

export type PlayerPose = "idle" | "run" | "kick" | "dive-left" | "dive-right";

export type PlayerHandle = {
  root: THREE.Group | null;
  footWorld: THREE.Vector3;
  setPose: (pose: PlayerPose) => void;
  drive: (elapsed: number, kicking: boolean) => void;
};

type KitRole = "shooter" | "keeper";

type ActionBank = {
  idle?: THREE.AnimationAction;
  run?: THREE.AnimationAction;
  kick?: THREE.AnimationAction;
  dive?: THREE.AnimationAction;
};

const MESH_GLB = "/models/xbot.glb";
const DIVE_GLB = "/models/mixamo-gk-dive-clip.glb";

const IDLE_RUN_FADE = 0.12;
const STRIKE_FADE = 0.08;
const STRIKE_SPEED = 1.2;
const DIVE_SPEED = 1.35;

const _size = new THREE.Vector3();
const _box = new THREE.Box3();
const _color = new THREE.Color();
const _shirt = new THREE.Color();
const _euler = new THREE.Euler();
const _extra = new THREE.Quaternion();

function boneKey(name: string) {
  return name.replace(/^mixamorig[:_]?/i, "").toLowerCase();
}

function boneMap(root: THREE.Object3D) {
  const bones: Record<string, THREE.Bone> = {};
  root.traverse((node) => {
    if (!(node as THREE.Bone).isBone) return;
    bones[boneKey(node.name)] = node as THREE.Bone;
  });
  return bones;
}

function fitClip(clip: THREE.AnimationClip, root: THREE.Object3D) {
  const names = new Map<string, string>();
  root.traverse((node) => {
    if ((node as THREE.Bone).isBone) names.set(boneKey(node.name), node.name);
  });
  const next = clip.clone();
  next.name = clip.name;
  next.tracks = next.tracks.flatMap((track) => {
    const split = track.name.split(".");
    const node = split[0] ?? "";
    const prop = split.slice(1).join(".");
    if (!prop || prop === "scale") return [];
    const target = names.get(boneKey(node));
    if (!target) return [];
    if (prop === "position" && boneKey(target) !== "hips") return [];
    const copy = track.clone();
    copy.name = `${target}.${prop}`;
    return [copy];
  });
  return next;
}

function clipNamed(clips: THREE.AnimationClip[], name: string) {
  const want = name.toLowerCase();
  return clips.find((clip) => clip.name.toLowerCase().includes(want));
}

function bindMul(bind: THREE.Quaternion, x: number, y: number, z: number) {
  _euler.set(x, y, z, "XYZ");
  _extra.setFromEuler(_euler);
  return bind.clone().multiply(_extra);
}

function quatTrack(
  bone: THREE.Bone | undefined,
  times: number[],
  eulers: number[][],
) {
  if (!bone) return null;
  const bind = bone.quaternion.clone();
  const values: number[] = [];
  for (const [x, y, z] of eulers) {
    const q = bindMul(bind, x, y, z);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(
    `${bone.name}.quaternion`,
    times,
    values,
  );
}

/** Bind-relative soccer strike: backswing → whip → follow-through. */
function makeStrikeClip(root: THREE.Object3D) {
  const bones = boneMap(root);
  const times = [0, 0.16, 0.32, 0.44, 0.62, 0.82];
  const tracks = [
    quatTrack(bones.rightupleg, times, [
      [0, 0, 0],
      [0.95, 0.08, 0.12],
      [1.15, 0.04, 0.18],
      [-1.22, -0.08, 0.05],
      [-0.55, -0.04, 0.02],
      [0, 0, 0],
    ]),
    quatTrack(bones.rightleg, times, [
      [0, 0, 0],
      [1.15, 0, 0],
      [1.35, 0, 0],
      [0.12, 0, 0],
      [0.45, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack(bones.rightfoot, times, [
      [0, 0, 0],
      [-0.35, 0.1, 0],
      [-0.55, 0.16, 0],
      [0.42, -0.08, 0],
      [0.18, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack(bones.leftupleg, times, [
      [0, 0, 0],
      [0.12, -0.04, -0.08],
      [0.18, -0.06, -0.1],
      [0.22, -0.04, -0.06],
      [0.08, 0, 0],
      [0, 0, 0],
    ]),
    quatTrack(bones.hips, times, [
      [0, 0, 0],
      [0.06, 0.18, -0.08],
      [0.08, 0.22, -0.1],
      [-0.12, -0.16, 0.12],
      [-0.04, -0.06, 0.04],
      [0, 0, 0],
    ]),
    quatTrack(bones.spine, times, [
      [0, 0, 0],
      [0.12, 0.14, 0],
      [0.16, 0.18, 0],
      [-0.18, -0.12, 0],
      [-0.06, -0.04, 0],
      [0, 0, 0],
    ]),
    quatTrack(bones.rightarm, times, [
      [0, 0, 0],
      [-0.35, 0.2, 0.4],
      [-0.45, 0.25, 0.5],
      [0.55, -0.15, -0.35],
      [0.18, 0, -0.1],
      [0, 0, 0],
    ]),
    quatTrack(bones.leftarm, times, [
      [0, 0, 0],
      [0.45, -0.12, -0.35],
      [0.55, -0.16, -0.42],
      [-0.25, 0.1, 0.22],
      [-0.08, 0, 0.08],
      [0, 0, 0],
    ]),
  ].filter((track): track is THREE.QuaternionKeyframeTrack => Boolean(track));
  return new THREE.AnimationClip("strike", 0.82, tracks);
}

function tintRig(root: THREE.Object3D, role: KitRole, teamId?: string | null) {
  const shirt =
    role === "keeper" ? keeperKit(teamId).primary : teamConfig(teamId).primary;
  const trim =
    role === "keeper" ? keeperKit(teamId).secondary : teamConfig(teamId).secondary;
  _shirt.set(shirt);
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = source.map((mat) => {
      const copy = (mat as THREE.MeshStandardMaterial).clone();
      if ("color" in copy && copy.color) {
        const joints = /joint/i.test(mesh.name);
        copy.color.copy(_color.set(joints ? trim : "#c4a574"));
        if (!joints) copy.color.lerp(_shirt, 0.78);
      }
      if ("roughness" in copy) copy.roughness = 0.46;
      if ("metalness" in copy) copy.metalness = 0.04;
      if ("envMapIntensity" in copy) copy.envMapIntensity = 0.8;
      copy.side = THREE.DoubleSide;
      copy.needsUpdate = true;
      return copy;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
}

function prepareClone(
  source: THREE.Object3D,
  role: KitRole,
  teamId: string | null | undefined,
  height: number,
) {
  const clone = SkeletonUtils.clone(source) as THREE.Group;
  clone.rotation.set(0, 0, 0);
  clone.position.set(0, 0, 0);
  clone.updateMatrixWorld(true);
  _box.setFromObject(clone);
  _box.getSize(_size);
  // Mixamo X/Y Bot ships as cm verts under a 0.01 armature. An unmounted
  // SkinnedMesh bbox is often ~0 or ~1.8cm; do not treat that as world height
  // or the clone collapses to millimeters and disappears on the FIFA camera.
  if (_size.y > 0.5) {
    clone.scale.multiplyScalar(height / _size.y);
  }
  clone.updateMatrixWorld(true);
  _box.setFromObject(clone);
  if (Number.isFinite(_box.min.y) && Math.abs(_box.min.y) < 10) {
    clone.position.y -= _box.min.y;
  }
  tintRig(clone, role, teamId);
  return clone;
}

export const RigPlayer = forwardRef<
  PlayerHandle,
  {
    kit: KitRole;
    teamId?: string | null;
    position: [number, number, number];
    height?: number;
  }
>(function RigPlayer({ kit, teamId, position, height = 1.86 }, ref) {
  const root = useRef<THREE.Group>(null);
  const diveG = useRef<THREE.Group>(null);
  const pose = useRef<PlayerPose>("idle");
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<ActionBank>({});
  const active = useRef<THREE.AnimationAction | null>(null);
  const footWorld = useRef(new THREE.Vector3());
  const hipsHold = useRef({ x: 0, z: 0, ready: false });
  const fadeToRef = useRef<(next: PlayerPose) => void>(() => undefined);

  const loco = useGLTF(MESH_GLB);
  const diveGltf = useGLTF(DIVE_GLB);

  const clone = useMemo(
    () => prepareClone(loco.scene, kit, teamId, height),
    [loco.scene, kit, teamId, height],
  );
  const bones = useMemo(() => boneMap(clone), [clone]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clone);
    mixerRef.current = mixer;
    const idleSrc = clipNamed(loco.animations, "idle") ?? loco.animations[0];
    const runSrc = clipNamed(loco.animations, "run") ?? loco.animations[1];
    const diveSrc = diveGltf.animations[0];
    const kickSrc = makeStrikeClip(clone);

    if (idleSrc) {
      const action = mixer.clipAction(fitClip(idleSrc, clone));
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions.current.idle = action;
    }
    if (runSrc) {
      const action = mixer.clipAction(fitClip(runSrc, clone));
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 1.18;
      actions.current.run = action;
    }
    if (kickSrc) {
      const action = mixer.clipAction(kickSrc);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = STRIKE_SPEED;
      actions.current.kick = action;
    }
    if (diveSrc) {
      const action = mixer.clipAction(fitClip(diveSrc, clone));
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.timeScale = DIVE_SPEED;
      actions.current.dive = action;
    }

    const hips = bones.hips;
    if (hips) {
      hipsHold.current.x = hips.position.x;
      hipsHold.current.z = hips.position.z;
      hipsHold.current.ready = true;
    }

    const start = actions.current.idle;
    start?.reset().fadeIn(IDLE_RUN_FADE).play();
    active.current = start ?? null;

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clone);
      mixerRef.current = null;
      actions.current = {};
      active.current = null;
    };
  }, [clone, bones.hips, loco.animations, diveGltf.animations]);

  fadeToRef.current = (next) => {
    const bank = actions.current;
    const target =
      next === "run"
        ? bank.run
        : next === "kick"
          ? bank.kick
          : next === "dive-left" || next === "dive-right"
            ? bank.dive
            : bank.idle;
    if (!target) return;
    if (diveG.current) {
      diveG.current.scale.x = next === "dive-right" ? -1 : 1;
    }
    if (active.current === target) {
      if (next === "kick" || next === "dive-left" || next === "dive-right") {
        target.reset().play();
      }
      return;
    }
    const fade =
      next === "idle" || next === "run" ? IDLE_RUN_FADE : STRIKE_FADE;
    target.reset().setEffectiveWeight(1).fadeIn(fade).play();
    active.current?.fadeOut(fade);
    active.current = target;
  };

  useImperativeHandle(ref, () => ({
    get root() {
      return root.current;
    },
    get footWorld() {
      return footWorld.current;
    },
    setPose(next) {
      pose.current = next;
      fadeToRef.current(next);
    },
    drive() {},
  }));

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    const hips = bones.hips;
    if (hips && hipsHold.current.ready) {
      hips.position.x = hipsHold.current.x;
      hips.position.z = hipsHold.current.z;
    }
    const foot = bones.rightfoot;
    if (foot) foot.getWorldPosition(footWorld.current);
  });

  const faceY = kit === "shooter" ? Math.PI : 0;

  return (
    <group ref={root} position={position}>
      <group rotation={[0, faceY, 0]}>
        <group ref={diveG}>
          <primitive object={clone} />
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.04]}>
        <circleGeometry args={[0.38, 18]} />
        <meshBasicMaterial
          color="#07090f"
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

export const PhotoPlayer = RigPlayer;
export const KitPlayer = RigPlayer;

useGLTF.preload(MESH_GLB);
useGLTF.preload(DIVE_GLB);
