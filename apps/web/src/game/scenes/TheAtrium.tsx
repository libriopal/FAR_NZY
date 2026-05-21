// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// TheAtrium scene — INDUSTRIAL + BIOLOGICAL + CRYSTALLINE blend.
// Social hub — underground civilization illusion.
// Crowd positions seeded deterministically from session index — never Math.random().
// Rain event triggered by Zustand signal only.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR, CURRENCY, OV } from '../../theme/tokens.js';

// ── Rain event shape — from Zustand ──────────────────────────────────────────
export type RainCurrency = 'fd' | 'pdx';

export interface AtriumRainEvent {
  active:   boolean;
  currency: RainCurrency;
  count:    number; // particle count, sourced from server
}

export interface TheAtriumProps {
  playerCount?: number;      // 0–200, from server session data
  rainEvent?:   AtriumRainEvent;
}

// ── Simulated crowd — instanced capsules ─────────────────────────────────────
// Positions derived from a deterministic Halton sequence — never Math.random().
function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

const CROWD_GEOMETRY = new THREE.CapsuleGeometry(0.08, 0.22, 4, 8);
const CROWD_MATERIAL = new THREE.MeshStandardMaterial({
  color: PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a',
  roughness: 0.8,
  metalness: 0.1,
});

function SimulatedCrowd({ count }: { count: number }) {
  const clampedCount = Math.min(200, Math.max(0, count));
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Deterministic initial positions using Halton (base 2, base 3)
  const initialPositions = useMemo(() => {
    const dummy = new THREE.Object3D();
    const positions: THREE.Matrix4[] = [];
    for (let i = 0; i < clampedCount; i++) {
      const x = (halton(i + 1, 2) - 0.5) * 14;
      const z = (halton(i + 1, 3) - 0.5) * 10;
      dummy.position.set(x, -1.0, z);
      dummy.rotation.y = halton(i + 1, 5) * Math.PI * 2;
      dummy.scale.setScalar(0.8 + halton(i + 1, 7) * 0.4);
      dummy.updateMatrix();
      positions.push(dummy.matrix.clone());
    }
    return positions;
  }, [clampedCount]);

  // Initialize instance matrices on first render via useFrame guard
  const initDone = useRef(false);

  // Slow deterministic walk animation — each figure has a unique phase
  const phaseRef = useRef<Float32Array>(new Float32Array(
    Array.from({ length: clampedCount }, (_, i) => halton(i + 1, 11) * Math.PI * 2),
  ));

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const phases = phaseRef.current;

    // Set initial matrices on first frame (can't do this before mesh mounts)
    if (!initDone.current) {
      initialPositions.forEach((mat, i) => {
        meshRef.current!.setMatrixAt(i, mat);
      });
      initDone.current = true;
    }

    for (let i = 0; i < clampedCount; i++) {
      const phase = phases[i] ?? 0;
      const angle = phase + t * 0.15;
      const walkR = 1.5 + (i % 5) * 0.8;
      dummy.position.x = Math.cos(angle) * walkR + (halton(i + 1, 2) - 0.5) * 10;
      dummy.position.y = -1.0;
      dummy.position.z = Math.sin(angle) * walkR + (halton(i + 1, 3) - 0.5) * 7;
      dummy.rotation.y = angle + Math.PI / 2;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (clampedCount === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[CROWD_GEOMETRY, CROWD_MATERIAL, clampedCount]}
      castShadow
    />
  );
}

// ── Rain event — FD=cyan, PDX=ultraviolet ────────────────────────────────────
function RainCeremony({ event }: { event: AtriumRainEvent }) {
  if (!event.active) return null;

  const color = event.currency === 'fd'
    ? CURRENCY.fd.color          // toxic cyan #00e5cc
    : CURRENCY.pdx.color;        // ultraviolet #7b00ff

  const clampedCount = Math.min(400, Math.max(50, event.count));

  return (
    <Sparkles
      position={[0, 4.5, 0]}
      count={clampedCount}
      scale={[16, 0.5, 12]}
      size={1.2}
      speed={1.8}
      opacity={0.8}
      color={color}
      noise={0.5}
    />
  );
}

// ── Central hall — large concrete box ────────────────────────────────────────
function CentralHall() {
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]} receiveShadow>
        <planeGeometry args={[18, 14, 1, 1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Walls — back and sides using BackSide box */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[18, 8, 14]} />
        <meshStandardMaterial color="#222222" roughness={0.9} metalness={0.0} side={THREE.BackSide} />
      </mesh>

      {/* Amber accent light strips along ceiling */}
      {[-6, -2, 2, 6].map((x, i) => (
        <mesh key={i} position={[x, 5.9, 0]}>
          <boxGeometry args={[1.8, 0.04, 12]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.primary}
            emissive={PILLAR.INDUSTRIAL.primary}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Holographic market screen — PlaneGeometry with emissive canvas material ────
function HoloScreen({ position, rotation }: {
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.getElapsedTime();
    matRef.current.emissiveIntensity = 0.4 + 0.15 * Math.sin(t * 1.5);
  });

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[2.2, 1.4, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color={PILLAR.INDUSTRIAL.surface}
        emissive={PILLAR.INDUSTRIAL.primary}
        emissiveIntensity={0.4}
        roughness={0.1}
        metalness={0.5}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function TheAtriumScene({
  playerCount = 40,
  rainEvent   = { active: false, currency: 'fd', count: 0 },
}: TheAtriumProps) {
  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 3, 9], fov: 60, near: 0.1, far: 80 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.9,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.INDUSTRIAL.surface }}
    >
      <fog attach="fog" args={[PILLAR.INDUSTRIAL.surface, 14, 50]} />
      <Environment preset="warehouse" />

      <ambientLight color="#111111" intensity={0.35} />

      {/* Amber ceiling strips cast light down */}
      {[-6, -2, 2, 6].map((x, i) => (
        <pointLight
          key={i}
          position={[x, 5.5, 0]}
          color={PILLAR.INDUSTRIAL.primary}
          intensity={1.2}
          distance={10}
          decay={2}
        />
      ))}

      {/* UV accent — crystalline contamination */}
      <pointLight
        position={[0, 2, 4]}
        color={PILLAR.CRYSTALLINE.primary}
        intensity={0.8}
        distance={8}
        decay={2}
      />

      <CentralHall />

      {/* Holographic screens — back wall */}
      <HoloScreen position={[-4, 1.8, -6.9]} rotation={[0, 0, 0]} />
      <HoloScreen position={[ 0, 1.8, -6.9]} rotation={[0, 0, 0]} />
      <HoloScreen position={[ 4, 1.8, -6.9]} rotation={[0, 0, 0]} />

      {/* Ambient biological contamination — BIOLOGICAL presence in industrial space */}
      <Sparkles
        position={[0, 3.5, 0]}
        count={60}
        scale={[16, 4, 12]}
        size={0.5}
        speed={0.08}
        opacity={0.2}
        color={PILLAR.BIOLOGICAL.highlight}
        noise={0.3}
      />

      <SimulatedCrowd count={playerCount} />

      <RainCeremony event={rainEvent} />
    </Canvas>
  );
}
