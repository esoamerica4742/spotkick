"use client";

import { OLED } from "@/lib/constants";
import { Billboard, useTexture } from "@react-three/drei";
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";

export type PlayerPose =
  | "idle"
  | "run"
  | "plant"
  | "kick"
  | "contact"
  | "follow"
  | "dive-left"
  | "dive-right"
  | "jump";

export type PlayerHandle = {
  root: THREE.Group | null;
  footWorld: THREE.Vector3;
  setPose: (pose: PlayerPose) => void;
  drive: (elapsed: number, kicking: boolean, swing?: number, delta?: number) => void;
};

const SHOOTER_RED: Record<PlayerPose, string> = {
  idle: "/textures/players/striker-idle-left.png",
  run: "/textures/players/striker-run-back.png",
  plant: "/textures/players/striker-run-back.png",
  kick: "/textures/players/striker-kick-left.png",
  contact: "/textures/players/striker-contact-left.png",
  follow: "/textures/players/striker-kick-back.png",
  "dive-left": "/textures/players/striker-idle-left.png",
  "dive-right": "/textures/players/striker-idle-left.png",
  jump: "/textures/players/striker-idle-left.png",
};

const SHOOTER_BLUE: Record<PlayerPose, string> = {
  idle: "/textures/players/striker-idle-left-blue.png",
  run: "/textures/players/striker-run-back-blue.png",
  plant: "/textures/players/striker-run-back-blue.png",
  kick: "/textures/players/striker-kick-left-blue.png",
  contact: "/textures/players/striker-contact-left-blue.png",
  follow: "/textures/players/striker-kick-back-blue.png",
  "dive-left": "/textures/players/striker-idle-left-blue.png",
  "dive-right": "/textures/players/striker-idle-left-blue.png",
  jump: "/textures/players/striker-idle-left-blue.png",
};

export type ShooterSeat = "a" | "b";
export type ShooterPalette = "red" | "blue";

/** User A always red, user B always blue — kits never mix. */
export function shooterPalette(
  _teamId?: string | null,
  _opponentTeamId?: string | null,
  seat: ShooterSeat = "a",
): ShooterPalette {
  return seat === "b" ? "blue" : "red";
}

function shooterKit(palette: ShooterPalette) {
  return palette === "blue" ? SHOOTER_BLUE : SHOOTER_RED;
}

const KEEPER: Record<PlayerPose, string> = {
  idle: "/textures/players/keeper-idle.png",
  run: "/textures/players/keeper-idle.png",
  plant: "/textures/players/keeper-idle.png",
  kick: "/textures/players/keeper-idle.png",
  contact: "/textures/players/keeper-idle.png",
  follow: "/textures/players/keeper-idle.png",
  "dive-left": "/textures/players/keeper-dive-left.png",
  "dive-right": "/textures/players/keeper-dive-right.png",
  jump: "/textures/players/keeper-jump.png",
};

const POSES: PlayerPose[] = [
  "idle",
  "run",
  "plant",
  "kick",
  "contact",
  "follow",
  "dive-left",
  "dive-right",
  "jump",
];

const keyed = new WeakSet<THREE.Texture>();
const _foot = new THREE.Vector3();

function keyGreen(texture: THREE.Texture) {
  if (keyed.has(texture)) return;
  const image = texture.image as CanvasImageSource & {
    width: number;
    height: number;
  };
  if (!image?.width) return;
  const w = image.width;
  const h = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const watermark = Math.floor(h * 0.055);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (y >= h - watermark) {
        px[i + 3] = 0;
        continue;
      }
      const r = px[i]!;
      const g = px[i + 1]!;
      const b = px[i + 2]!;
      if (g > 145 && g > r + 32 && g > b + 32) {
        const spill = Math.min(1, (g - Math.max(r, b)) / 88);
        px[i + 3] = Math.round(px[i + 3]! * (1 - spill));
      }
    }
  }
  ctx.putImageData(data, 0, 0);
  texture.image = canvas;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  keyed.add(texture);
}

function planeSize(pose: PlayerPose, height: number): [number, number] {
  if (pose === "dive-left" || pose === "dive-right") {
    return [height * 1.55, height * 0.92];
  }
  if (pose === "jump") {
    return [height * 1.18, height * 1.08];
  }
  if (pose === "kick" || pose === "plant" || pose === "run") {
    return [height * 1.08, height];
  }
  if (pose === "contact" || pose === "follow") {
    return [height * 1.22, height];
  }
  return [height * 0.92, height];
}

export const PhotoPlayer = forwardRef<
  PlayerHandle,
  {
    kit: "shooter" | "keeper";
    teamId?: string | null;
    palette?: ShooterPalette;
    position: [number, number, number];
    height?: number;
  }
>(function PhotoPlayer(
  { kit, teamId: _teamId, palette = "red", position, height = 1.86 },
  ref,
) {
  const root = useRef<THREE.Group>(null);
  const pose = useRef<PlayerPose>("idle");
  const mesh = useRef<THREE.Mesh>(null);
  const fade = useRef<THREE.Mesh>(null);
  const blend = useRef(1);
  const footWorld = useRef(new THREE.Vector3());
  const urls = kit === "shooter" ? shooterKit(palette) : KEEPER;
  const maps = useTexture(POSES.map((name) => urls[name])) as THREE.Texture[];
  const bank = useMemo(() => {
    const next: Partial<Record<PlayerPose, THREE.Texture>> = {};
    POSES.forEach((name, index) => {
      next[name] = maps[index];
    });
    return next;
  }, [maps]);

  useLayoutEffect(() => {
    for (const texture of maps) {
      if (texture) keyGreen(texture);
    }
  }, [maps]);

  useImperativeHandle(ref, () => ({
    get root() {
      return root.current;
    },
    get footWorld() {
      return footWorld.current;
    },
    setPose(next) {
      if (pose.current === next) return;
      const prevMap = bank[pose.current] ?? bank.idle;
      const nextMap = bank[next] ?? bank.idle;
      pose.current = next;
      const fadeMat = fade.current?.material as THREE.MeshStandardMaterial | undefined;
      const mat = mesh.current?.material as THREE.MeshStandardMaterial | undefined;
      if (fadeMat && prevMap) {
        fadeMat.map = prevMap;
        fadeMat.opacity = 1;
        fadeMat.needsUpdate = true;
      }
      if (mat && nextMap) {
        mat.map = nextMap;
        mat.opacity = 0;
        mat.needsUpdate = true;
      }
      blend.current = 0;
      const [w, h] = planeSize(next, height);
      if (mesh.current) {
        mesh.current.scale.set(w, h, 1);
        mesh.current.position.y = h * 0.5;
      }
      if (fade.current) {
        fade.current.scale.set(w, h, 1);
        fade.current.position.y = h * 0.5;
      }
    },
    drive(elapsed, kicking, swing = 0, delta = 0.016) {
      const card = mesh.current;
      const ghost = fade.current;
      const group = root.current;
      if (!card) return;
      blend.current = Math.min(1, blend.current + delta * 10.5);
      const mat = card.material as THREE.MeshStandardMaterial;
      mat.opacity = blend.current;
      if (ghost) {
        const fadeMat = ghost.material as THREE.MeshStandardMaterial;
        fadeMat.opacity = 1 - blend.current;
        ghost.visible = blend.current < 0.98;
      }
      const [w, h] = planeSize(pose.current, height);
      const bob = kicking ? 0 : Math.sin(elapsed * 1.65) * 0.016;
      const s = Math.min(1, Math.max(0, swing));
      const whip = Math.sin(s * Math.PI);
      if (pose.current === "run") {
        const stride = Math.sin(elapsed * 13.2);
        card.rotation.x = 0.12;
        card.position.set(stride * 0.042, h * 0.5 + Math.abs(stride) * 0.055, 0);
        card.scale.set(w, h, 1);
        _foot.set(-w * 0.1, 0.1, 0.18);
      } else if (pose.current === "kick" || pose.current === "plant") {
        card.rotation.x = -0.08 + s * 0.16;
        card.position.set(0, h * 0.5 - whip * 0.04, -s * 0.08);
        card.scale.set(w * (1 + whip * 0.03), h * (1 - whip * 0.06), 1);
        _foot.set(-w * 0.11, 0.11, -0.18 - s * 0.2);
      } else if (pose.current === "contact" || pose.current === "follow") {
        card.rotation.x = 0.04;
        card.position.set(0, h * 0.5, -0.1);
        card.scale.set(w, h, 1);
        _foot.set(-w * 0.08, 0.11, -0.38);
      } else if (pose.current === "jump") {
        card.rotation.set(0, 0, 0);
        card.position.set(0, h * 0.5, 0);
        card.scale.set(w, h, 1);
        _foot.set(0, 0.2, 0);
      } else if (
        pose.current === "dive-left" ||
        pose.current === "dive-right"
      ) {
        const side = pose.current === "dive-left" ? 1 : -1;
        card.rotation.z = side * (0.14 + s * 0.1);
        card.position.set(side * (0.1 + s * 0.12), h * 0.5 + s * 0.06, 0);
        card.scale.set(w * (1 + s * 0.08), h * (1 - s * 0.04), 1);
        _foot.set(side * 0.22, 0.2, 0);
      } else {
        card.rotation.set(0, 0, 0);
        card.position.set(0, h * 0.5 + bob, 0);
        card.scale.set(w, h, 1);
        _foot.set(-w * 0.08, 0.08, 0.12);
      }
      if (ghost) {
        ghost.rotation.copy(card.rotation);
        ghost.position.copy(card.position);
        ghost.scale.copy(card.scale);
      }
      if (group) group.localToWorld(footWorld.current.copy(_foot));
    },
  }));

  const [w, h] = planeSize("idle", height);

  return (
    <group ref={root} position={position}>
      <Billboard follow lockX lockZ>
        <mesh ref={fade} renderOrder={0} position={[0, h * 0.5, 0]} scale={[w, h, 1]} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            map={bank.idle}
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            roughness={0.58}
            metalness={0}
            envMapIntensity={0.62}
            emissive="#1a1812"
            emissiveIntensity={0.16}
          />
        </mesh>
        <mesh ref={mesh} renderOrder={1} position={[0, h * 0.5, 0]} scale={[w, h, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial
            map={bank.idle}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            roughness={0.58}
            metalness={0}
            envMapIntensity={0.62}
            emissive="#1a1812"
            emissiveIntensity={0.16}
          />
        </mesh>
      </Billboard>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.04]}>
        <circleGeometry args={[0.38, 18]} />
        <meshBasicMaterial
          color={OLED}
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

useTexture.preload(SHOOTER_RED.idle);
useTexture.preload(SHOOTER_RED.run);
useTexture.preload(SHOOTER_RED.plant);
useTexture.preload(SHOOTER_RED.kick);
useTexture.preload(SHOOTER_RED.contact);
useTexture.preload(SHOOTER_RED.follow);
useTexture.preload(SHOOTER_BLUE.idle);
useTexture.preload(SHOOTER_BLUE.run);
useTexture.preload(SHOOTER_BLUE.plant);
useTexture.preload(SHOOTER_BLUE.kick);
useTexture.preload(SHOOTER_BLUE.contact);
useTexture.preload(SHOOTER_BLUE.follow);
useTexture.preload(KEEPER.idle);
useTexture.preload(KEEPER.jump);
useTexture.preload(KEEPER["dive-left"]);
useTexture.preload(KEEPER["dive-right"]);
