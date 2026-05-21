// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// VaultCrossSection scene — INDUSTRIAL pillar.
// Starter tier: cross-section rooms, server racks, reactor core, traffic particles.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR } from '../../theme/tokens.js';

// ── Server rack — stack of boxes with blinking emissive panels ────────────────
function ServerRack({ position }: { position: [number, number, number] }) {
  const panelRefs = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    panelRefs.current.forEach((mat, i) => {
      if (!mat) return;
      // Independent blink per panel using offset sine
      const blink = Math.sin(t * (2.0 + i * 0.7) + i * 1.3);
      mat.emissiveIntensity = blink > 0.4 ? 1.0 : 0.1;
    });
  });

  const panelOffsets: number[] = useMemo(() => [-0.55, -0.25, 0.05, 0.35, 0.65], []);

  return (
    <group position={position}>
      {/* Rack body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.7, 0.4]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.surface}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>
      {/* Status panels */}
      {panelOffsets.map((yOff, i) => (
        <mesh key={i} position={[0.21, yOff, 0]} castShadow>
          <boxGeometry args={[0.04, 0.08, 0.2]} />
          <meshStandardMaterial
            ref={el => { if (el) panelRefs.current[i] = el; }}
            color={i % 2 === 0 ? PILLAR.INDUSTRIAL.primary : PILLAR.INDUSTRIAL.accent}
            emissive={i % 2 === 0 ? PILLAR.INDUSTRIAL.primary : PILLAR.INDUSTRIAL.accent}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Reactor core — pulsing sphere with child PointLight ───────────────────────
function ReactorCore({ position }: { position: [number, number, number] }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1.0 + 0.08 * Math.sin(t * 2.4) + 0.03 * Math.sin(t * 7.1);
    if (meshRef.current) meshRef.current.scale.setScalar(pulse);
    if (lightRef.current) lightRef.current.intensity = 3.0 + 2.0 * Math.sin(t * 2.4);
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.accent}
          emissive={PILLAR.INDUSTRIAL.accent}
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color={PILLAR.INDUSTRIAL.accent}
        intensity={3.0}
        distance={8}
        decay={2}
      />
    </group>
  );
}

// ── Elevator car — reads vault level from prop, animates Y ────────────────────
function Elevator({ vaultLevel, maxLevel }: { vaultLevel: number; maxLevel: number }) {
  const ref = useRef<THREE.Group>(null);
  const targetY = useRef(-1.5 + (vaultLevel / Math.max(1, maxLevel - 1)) * 3.0);

  // Update target when vaultLevel changes
  targetY.current = -1.5 + (vaultLevel / Math.max(1, maxLevel - 1)) * 3.0;

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y += (targetY.current - ref.current.position.y) * 0.04;
  });

  return (
    <group ref={ref} position={[2.6, -1.5, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.35, 0.5, 0.35]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a'}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>
      {/* Amber indicator strip */}
      <mesh position={[0, 0.27, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.primary}
          emissive={PILLAR.INDUSTRIAL.primary}
          emissiveIntensity={0.9}
        />
      </mesh>
    </group>
  );
}

// ── Server traffic particles — streams moving between rooms ───────────────────
const TRAFFIC_COUNT = 120;

function TrafficParticles() {
  const initialPos = useMemo(() => {
    const pos = new Float32Array(TRAFFIC_COUNT * 3);
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      pos[i * 3]     = (i % 3) * 2.0 - 2.0;       // X: 3 column lanes
      pos[i * 3 + 1] = ((i * 0.137) % 1) * 4 - 2; // Y: random vertical start
      pos[i * 3 + 2] = 0;
    }
    return pos;
  }, []);

  const posRef  = useRef<Float32Array>(initialPos);
  const attrRef = useRef<THREE.BufferAttribute>(null);

  useFrame((_, dt) => {
    const pos = posRef.current;
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const yIdx  = i * 3 + 1;
      const speed = 0.8 + (i % 5) * 0.4;
      const dir   = i % 2 === 0 ? 1 : -1;
      const yNext = (pos[yIdx] ?? 0) + dir * speed * dt;
      pos[yIdx] = yNext > 2.5 ? -2.5 : yNext < -2.5 ? 2.5 : yNext;
    }
    if (attrRef.current) {
      (attrRef.current.array as Float32Array).set(pos);
      attrRef.current.needsUpdate = true;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          ref={attrRef}
          attach="attributes-position"
          args={[posRef.current, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={PILLAR.INDUSTRIAL.primary}
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

// ── Cross-section room walls — BoxGeometry arranged in grid ───────────────────
function CrossSectionRooms() {
  // 3 columns × 3 rows of rooms
  const rooms: Array<[number, number, number]> = useMemo(() => [
    [-2.2,  1.2, 0], [0,  1.2, 0], [2.2,  1.2, 0],
    [-2.2,  0.0, 0], [0,  0.0, 0], [2.2,  0.0, 0],
    [-2.2, -1.2, 0], [0, -1.2, 0], [2.2, -1.2, 0],
  ], []);

  return (
    <>
      {rooms.map((pos, i) => (
        <mesh key={i} position={pos} receiveShadow>
          <boxGeometry args={[1.8, 1.0, 0.6]} />
          <meshStandardMaterial
            color="#2a2a2a"
            metalness={0.1}
            roughness={0.95}
            side={THREE.BackSide}
          />
        </mesh>
      ))}
      {/* Horizontal floor/ceiling dividers */}
      {[-0.6, 0.6].map((y, i) => (
        <mesh key={`div-${i}`} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[7.0, 0.06, 0.7]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.surface}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export interface VaultCrossSectionProps {
  vaultLevel?: number; // 0-based floor index from Zustand
  maxLevel?:   number;
}

export function VaultCrossSectionScene({
  vaultLevel = 0,
  maxLevel   = 5,
}: VaultCrossSectionProps) {
  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 0, 7], fov: 52, near: 0.1, far: 60 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.INDUSTRIAL.surface }}
    >
      <fog attach="fog" args={[PILLAR.INDUSTRIAL.surface, 10, 40]} />
      <Environment preset="warehouse" />

      <ambientLight color="#111111" intensity={0.3} />
      <directionalLight
        position={[3, 5, 3]}
        color={PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a'}
        intensity={0.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <CrossSectionRooms />

      {/* Server racks — left column */}
      <ServerRack position={[-2.0,  0.85, 0.1]} />
      <ServerRack position={[-2.0, -0.35, 0.1]} />
      {/* Server racks — right column */}
      <ServerRack position={[ 2.0,  0.85, 0.1]} />
      <ServerRack position={[ 2.0, -0.35, 0.1]} />

      {/* Reactor core — center bottom room */}
      <ReactorCore position={[0, -1.1, 0]} />

      <Elevator vaultLevel={vaultLevel} maxLevel={maxLevel} />

      <TrafficParticles />
    </Canvas>
  );
}
