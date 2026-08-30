"use client";

import { OLED, type Zone } from "@/lib/constants";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export const ZONE_X: Record<Zone, number> = {
  left: -3.18,
  center: 0,
  right: 3.18,
};

/** Finish height of a placed shot — wings under the bar, center at mid-net. */
export const ZONE_Y: Record<Zone, number> = {
  left: 2.04,
  center: 1.16,
  right: 2.04,
};

export const GOAL_Z = -11.15;
export const GOAL_HALF_W = 3.66;
export const GOAL_H = 2.44;

export function goalWorldFromMilli(x: number, y: number) {
  return {
    x: (x / 1000) * GOAL_HALF_W,
    y: (y / 1000) * GOAL_H,
    z: GOAL_Z + 0.14,
  };
}

export function MatchAtmosphere() {
  return (
    <>
      <color attach="background" args={[OLED]} />
      <fog attach="fog" args={[OLED, 26, 72]} />
      <hemisphereLight args={["#9eb6d4", "#10180f", 0.52]} />
      <ambientLight intensity={0.26} />
      <directionalLight
        castShadow
        position={[4, 20, 9]}
        intensity={2.05}
        color="#fff1c8"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00028}
        shadow-camera-near={2}
        shadow-camera-far={42}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={16}
        shadow-camera-bottom={-12}
      />
      <spotLight
        position={[-11, 16, 7]}
        angle={0.42}
        penumbra={0.72}
        intensity={128}
        color="#ffe3a0"
        distance={48}
        decay={1.08}
        castShadow={false}
      />
      <spotLight
        position={[11, 16, 7]}
        angle={0.42}
        penumbra={0.72}
        intensity={118}
        color="#eef4ff"
        distance={48}
        decay={1.08}
      />
      <spotLight
        position={[0, 17, -15]}
        angle={0.55}
        penumbra={0.6}
        intensity={148}
        color="#fff4cc"
        distance={40}
        decay={1.0}
      />
      <spotLight
        position={[0, 12, 14]}
        angle={0.5}
        penumbra={0.7}
        intensity={78}
        color="#fff8ea"
        distance={36}
        decay={1.12}
      />
      <pointLight position={[0.2, 3.4, 5.8]} intensity={18} color="#fff3d0" distance={14} decay={2} />
      <pointLight position={[0, 4.2, -9.4]} intensity={22} color="#e8f0ff" distance={12} decay={2} />
    </>
  );
}

function useLedBoard() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const band = ctx.createLinearGradient(0, 0, 0, 128);
    band.addColorStop(0, "#5a0710");
    band.addColorStop(0.45, "#b11222");
    band.addColorStop(1, "#3d040a");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 8, 1024, 4);
    ctx.fillRect(0, 116, 1024, 4);
    ctx.fillStyle = "#f4e7b2";
    ctx.font = "800 46px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 4; i += 1) {
      ctx.fillText("SPOTKICKA", 128 + i * 256, 66);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.repeat.set(2, 1);
    return texture;
  }, []);
}

function FloodLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.35, 0.22, 0.55]} />
        <meshBasicMaterial color="#fff6d2" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.28, 0]}>
        <boxGeometry args={[1.5, 0.12, 0.7]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.7} metalness={0.4} />
      </mesh>
    </group>
  );
}

export function StadiumBowl() {
  const crowd = useTexture("/textures/stadium-crowd.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  });
  const led = useLedBoard();

  return (
    <group>
      <mesh position={[0, -0.08, -4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[72, 78]} />
        <meshStandardMaterial color={OLED} roughness={1} />
      </mesh>

      <mesh position={[0, 9.6, -26.5]}>
        <planeGeometry args={[58, 20]} />
        <meshBasicMaterial map={crowd} toneMapped={false} />
      </mesh>
      <mesh position={[0, 11.4, -28.2]}>
        <planeGeometry args={[62, 16]} />
        <meshBasicMaterial map={crowd} color="#8a909c" toneMapped={false} />
      </mesh>
      <mesh position={[-24.5, 8.4, -12.5]} rotation={[0, 0.78, 0]}>
        <planeGeometry args={[34, 18]} />
        <meshBasicMaterial map={crowd} toneMapped={false} />
      </mesh>
      <mesh position={[24.5, 8.4, -12.5]} rotation={[0, -0.78, 0]}>
        <planeGeometry args={[34, 18]} />
        <meshBasicMaterial map={crowd} toneMapped={false} />
      </mesh>

      <mesh position={[0, 17.4, -24]}>
        <boxGeometry args={[56, 0.55, 3.2]} />
        <meshStandardMaterial color="#12151c" roughness={0.55} metalness={0.35} />
      </mesh>
      <FloodLamp position={[-16, 16.7, -23.2]} />
      <FloodLamp position={[-5.5, 16.7, -23.2]} />
      <FloodLamp position={[5.5, 16.7, -23.2]} />
      <FloodLamp position={[16, 16.7, -23.2]} />
      <FloodLamp position={[-22, 14.8, -8]} />
      <FloodLamp position={[22, 14.8, -8]} />

      {led ? (
        <>
          <mesh position={[0, 0.78, -13.35]}>
            <boxGeometry args={[24, 1.15, 0.18]} />
            <meshStandardMaterial
              map={led}
              emissive="#4a0a12"
              emissiveIntensity={0.62}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[-13.4, 0.78, -4]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[18, 1.15, 0.18]} />
            <meshStandardMaterial
              map={led}
              emissive="#4a0a12"
              emissiveIntensity={0.48}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[13.4, 0.78, -4]} rotation={[0, -Math.PI / 2, 0]}>
            <boxGeometry args={[18, 1.15, 0.18]} />
            <meshStandardMaterial
              map={led}
              emissive="#4a0a12"
              emissiveIntensity={0.48}
              roughness={0.35}
            />
          </mesh>
        </>
      ) : null}

      <mesh position={[0, 1.55, -14.2]}>
        <boxGeometry args={[26, 2.2, 0.7]} />
        <meshStandardMaterial color="#c9d0d8" roughness={0.82} />
      </mesh>
    </group>
  );
}

export function Pitch() {
  const grass = useTexture("/textures/pitch-grass.png", (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 16;
    texture.repeat.set(5.5, 7.2);
  });

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -3.2]}
        receiveShadow
      >
        <planeGeometry args={[42, 48]} />
        <meshPhysicalMaterial
          map={grass}
          color="#c6deb2"
          roughness={0.68}
          metalness={0}
          clearcoat={0.16}
          clearcoatRoughness={0.48}
          envMapIntensity={0.32}
        />
      </mesh>
      <LineBox width={16.5} depth={16.5} z={-2.9} />
      <LineBox width={10.4} depth={5.5} z={-8.4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0.15]}>
        <circleGeometry args={[0.13, 28]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -8.4]}>
        <ringGeometry args={[1.82, 1.9, 56, 1, 0, Math.PI]} />
        <meshBasicMaterial color="#f4f7fb" />
      </mesh>
    </group>
  );
}

function LineBox({
  width,
  depth,
  z,
}: {
  width: number;
  depth: number;
  z: number;
}) {
  const hw = width / 2;
  const hd = depth / 2;
  const y = 0.018;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, y, -hd]}>
        <boxGeometry args={[width, 0.01, 0.055]} />
        <meshBasicMaterial color="#f7f9fc" />
      </mesh>
      <mesh position={[0, y, hd]}>
        <boxGeometry args={[width, 0.01, 0.055]} />
        <meshBasicMaterial color="#f7f9fc" />
      </mesh>
      <mesh position={[-hw, y, 0]}>
        <boxGeometry args={[0.055, 0.01, depth]} />
        <meshBasicMaterial color="#f7f9fc" />
      </mesh>
      <mesh position={[hw, y, 0]}>
        <boxGeometry args={[0.055, 0.01, depth]} />
        <meshBasicMaterial color="#f7f9fc" />
      </mesh>
    </group>
  );
}

function useNetTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = "rgba(245, 250, 255, 0.78)";
    ctx.lineWidth = 1.15;
    for (let x = 0; x <= 256; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 5);
    texture.anisotropy = 4;
    return texture;
  }, []);
}

const POST = {
  color: "#f6f8fb",
  roughness: 0.14,
  metalness: 0.62,
  envMapIntensity: 1.25,
} as const;

export function Goal({
  selected: _selected,
  pulse,
}: {
  selected: Zone | null;
  pulse?: MutableRefObject<number>;
}) {
  const r = 0.078;
  const net = useNetTexture();
  const netDepth = 1.55;
  const bag = useRef<THREE.Group>(null);

  useFrame(() => {
    const group = bag.current;
    if (!group) return;
    const hit = pulse?.current ?? 0;
    group.scale.set(1 + hit * 0.32, 1 + hit * 0.26, 1 + hit * 0.62);
    group.position.z = -hit * 0.52;
  });

  return (
    <group position={[0, 0, GOAL_Z]}>
      <mesh position={[-GOAL_HALF_W, GOAL_H / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, GOAL_H, 24]} />
        <meshStandardMaterial {...POST} />
      </mesh>
      <mesh position={[GOAL_HALF_W, GOAL_H / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, GOAL_H, 24]} />
        <meshStandardMaterial {...POST} />
      </mesh>
      <mesh position={[0, GOAL_H, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[r, r, GOAL_HALF_W * 2 + r * 2, 24]} />
        <meshStandardMaterial {...POST} />
      </mesh>
      <mesh position={[-GOAL_HALF_W, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
        <meshStandardMaterial color="#d9dee6" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[GOAL_HALF_W, 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.08, 16]} />
        <meshStandardMaterial color="#d9dee6" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[-GOAL_HALF_W, GOAL_H * 0.42, -netDepth]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, GOAL_H * 0.84, 12]} />
        <meshStandardMaterial {...POST} />
      </mesh>
      <mesh position={[GOAL_HALF_W, GOAL_H * 0.42, -netDepth]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, GOAL_H * 0.84, 12]} />
        <meshStandardMaterial {...POST} />
      </mesh>
      {net ? (
        <group ref={bag}>
          <mesh position={[0, GOAL_H / 2 - 0.04, -netDepth]} rotation={[0.08, 0, 0]}>
            <planeGeometry args={[GOAL_HALF_W * 2.02, GOAL_H]} />
            <meshBasicMaterial
              map={net}
              transparent
              opacity={0.78}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[0, GOAL_H + 0.02, -netDepth * 0.48]}
            rotation={[1.12, 0, 0]}
          >
            <planeGeometry args={[GOAL_HALF_W * 2.02, netDepth]} />
            <meshBasicMaterial
              map={net}
              transparent
              opacity={0.62}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[-GOAL_HALF_W, GOAL_H / 2, -netDepth / 2]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[netDepth, GOAL_H]} />
            <meshBasicMaterial
              map={net}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[GOAL_HALF_W, GOAL_H / 2, -netDepth / 2]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[netDepth, GOAL_H]} />
            <meshBasicMaterial
              map={net}
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}
