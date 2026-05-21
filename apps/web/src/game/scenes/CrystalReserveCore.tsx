// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// CrystalReserveCore scene — CRYSTALLINE pillar.
// Staking visualization chamber: trust, value, time.
// All scale/color state derived from Zustand staking state — never Math.random().
// Sacred Core: crystal growth MUST read from Zustand, never from wall-clock alone.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR, CURRENCY } from '../../theme/tokens.js';
import { createVoidshardMaterial, tickVoidshard } from '../VoidshardMaterial.js';

// ── Staking data shape — consumed from Zustand in parent ─────────────────────
export interface StakingChamberState {
  stakedPdx:       number; // total PDX staked across all chambers
  chambers: Array<{
    id:             string;
    stakeDurationMs: number; // total lock duration
    elapsedMs:      number;  // confirmed elapsed time from Zustand
    maturity:       number;  // 0–1, authoritative from Zustand
  }>;
}

const DEFAULT_STATE: StakingChamberState = {
  stakedPdx: 0,
  chambers: [
    { id: 'a', stakeDurationMs: 86_400_000, elapsedMs: 0, maturity: 0 },
    { id: 'b', stakeDurationMs: 86_400_000, elapsedMs: 0, maturity: 0 },
    { id: 'c', stakeDurationMs: 86_400_000, elapsedMs: 0, maturity: 0 },
    { id: 'd', stakeDurationMs: 86_400_000, elapsedMs: 0, maturity: 0 },
  ],
};

// ── Central reactor octahedron ────────────────────────────────────────────────
function Reactor() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += 0.25 * dt;
      ref.current.rotation.x += 0.10 * dt;
    }
  });
  return (
    <mesh ref={ref} castShadow>
      <octahedronGeometry args={[0.7, 0]} />
      <meshPhysicalMaterial
        color={PILLAR.CRYSTALLINE.primary}
        emissive={PILLAR.CRYSTALLINE.primary}
        emissiveIntensity={0.4}
        transmission={0.85}
        thickness={1.2}
        roughness={0.05}
        metalness={0.0}
        ior={1.8}
      />
    </mesh>
  );
}

// ── Energy transfer beams — 4 thin cylinders, animated emissive ───────────────
function EnergyBeam({ angle }: { angle: number }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const x = Math.cos(angle) * 1.8;
  const z = Math.sin(angle) * 1.8;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.getElapsedTime();
    matRef.current.emissiveIntensity = 0.5 + 0.45 * Math.sin(t * 2.0 + angle);
  });

  return (
    <mesh position={[x * 0.5, 0, z * 0.5]} rotation={[0, -angle, Math.PI / 2]}>
      <cylinderGeometry args={[0.025, 0.025, 1.8, 6]} />
      <meshStandardMaterial
        ref={matRef}
        color={PILLAR.CRYSTALLINE.accent}
        emissive={PILLAR.CRYSTALLINE.accent}
        emissiveIntensity={0.5}
        transparent
        opacity={0.75}
      />
    </mesh>
  );
}

// ── Crystal growth chamber — maturity drives scale + color ────────────────────
function GrowthChamber({
  angle,
  maturity,
}: {
  angle: number;
  maturity: number; // 0–1 from Zustand
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial | null>(null);
  const voidRef = useRef<boolean>(false);

  // Scale: 0.1 (seed) → 1.0 (mature) — driven by authoritative maturity value
  const targetScale = 0.1 + maturity * 0.9;

  // At maximum maturity, switch to VOIDSHARD material (MC-8 Option A: full shader)
  const isVoidshard = maturity >= 0.99;

  const x = Math.cos(angle) * 1.9;
  const z = Math.sin(angle) * 1.9;

  // Color interpolation: young (#4a0080) → mature (#7b00ff) → voidshard (#050008)
  const youngColor  = new THREE.Color(PILLAR.CRYSTALLINE.deep);
  const matureColor = new THREE.Color(PILLAR.CRYSTALLINE.primary);
  const baseColor   = youngColor.clone().lerp(matureColor, Math.min(maturity * 1.25, 1.0));

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    // Smooth scale lerp
    const s = meshRef.current.scale;
    const lerp = 0.05;
    s.x += (targetScale - s.x) * lerp;
    s.y += (targetScale - s.y) * lerp;
    s.z += (targetScale - s.z) * lerp;

    // Tick VOIDSHARD shader if active
    if (matRef.current && isVoidshard) {
      tickVoidshard(matRef.current, dt);
    }
  });

  // Swap to VOIDSHARD material at maturity
  useMemo(() => {
    if (isVoidshard && !voidRef.current) {
      voidRef.current = true;
      const mat = createVoidshardMaterial({ lightningIntensity: 0.95, fresnelPower: 1.3 });
      matRef.current = mat;
    }
  }, [isVoidshard]);

  return (
    <mesh
      ref={meshRef}
      position={[x, -0.2, z]}
      scale={[0.1, 0.1, 0.1]}
      castShadow
    >
      <octahedronGeometry args={[0.5, 1]} />
      {isVoidshard && matRef.current ? (
        <primitive object={matRef.current} attach="material" />
      ) : (
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.3 + maturity * 0.5}
          roughness={0.05}
          metalness={0.2}
        />
      )}
    </mesh>
  );
}

// ── Resonance sparkles — count scales with staked PDX ─────────────────────────
function ResonanceSparkles({ stakedPdx }: { stakedPdx: number }) {
  // Clamp count between 20 and 300, proportional to stake
  const count = Math.min(300, Math.max(20, Math.floor(stakedPdx / 10)));
  return (
    <Sparkles
      count={count}
      scale={[4.5, 3, 4.5]}
      size={0.9}
      speed={0.25}
      opacity={0.6}
      color={PILLAR.CRYSTALLINE.accent}
      noise={0.6}
    />
  );
}

// ── Reactor point light ────────────────────────────────────────────────────────
function ReactorLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.intensity = 2.5 + 1.0 * Math.sin(t * 1.8) + 0.4 * Math.sin(t * 5.2);
  });
  return (
    <pointLight
      ref={ref}
      position={[0, 0.5, 0]}
      color={PILLAR.CRYSTALLINE.primary}
      intensity={2.5}
      distance={10}
      decay={2}
    />
  );
}

// ── Scene inner — receives staking state as prop ──────────────────────────────
function CrystalReserveCoreInner({ staking }: { staking: StakingChamberState }) {
  const beamAngles = useMemo(() =>
    staking.chambers.map((_, i) => (i / staking.chambers.length) * Math.PI * 2),
    [staking.chambers.length],
  );

  return (
    <>
      <fog attach="fog" args={['#0d0018', 4, 28]} />
      <Environment preset="night" />
      <ambientLight color="#1a0033" intensity={0.35} />
      <ReactorLight />

      <Reactor />

      {beamAngles.map((angle, i) => (
        <EnergyBeam key={i} angle={angle} />
      ))}

      {staking.chambers.map((chamber, i) => (
        <GrowthChamber key={chamber.id} angle={beamAngles[i] ?? 0} maturity={chamber.maturity} />
      ))}

      <ResonanceSparkles stakedPdx={staking.stakedPdx} />
    </>
  );
}

// ── Scene root — pass staking state from parent (Zustand) ─────────────────────
export function CrystalReserveCoreScene({
  staking = DEFAULT_STATE,
}: {
  staking?: StakingChamberState;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 2.2, 5.5], fov: 55, near: 0.1, far: 60 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.CRYSTALLINE.surface }}
    >
      <CrystalReserveCoreInner staking={staking} />
    </Canvas>
  );
}
