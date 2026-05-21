// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// LoginGate scene — INDUSTRIAL + BIOLOGICAL blend.
// Pillar: INDUSTRIAL primary, BIOLOGICAL accent.
// Starter tier: geometry + particles + camera. No logic.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR } from '../../theme/tokens.js';

// ── Biomechanical lock ring — two counter-rotating tori ───────────────────────
function LockRing({ radius, speed, color }: { radius: number; speed: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.z += speed * dt;
      ref.current.rotation.x += speed * 0.3 * dt;
    }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.06, 8, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        metalness={0.8}
        roughness={0.3}
      />
    </mesh>
  );
}

// ── Vault door — flat slab with amber seam segments ───────────────────────────
function VaultDoor() {
  const frameRef = useRef<THREE.Group>(null);
  const seamRefs = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Seam emissive pulse — industrial reactor heartbeat
    seamRefs.current.forEach((m, i) => {
      if (m?.material instanceof THREE.MeshStandardMaterial) {
        m.material.emissiveIntensity = 0.4 + 0.35 * Math.sin(t * 1.2 + i * 0.8);
      }
    });
  });

  // Seam positions: horizontal strips across the door face
  const seamPositions: [number, number, number][] = useMemo(() => [
    [0, 1.4, 0.02], [0, 0.5, 0.02], [0, -0.4, 0.02], [0, -1.3, 0.02],
  ], []);

  return (
    <group ref={frameRef} position={[0, 0, -4]}>
      {/* Main slab */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4.2, 5.5, 0.45]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.surface}
          metalness={0.85}
          roughness={0.35}
        />
      </mesh>

      {/* Outer steel frame */}
      <mesh position={[0, 0, 0.2]}>
        <boxGeometry args={[4.6, 5.9, 0.05]} />
        <meshStandardMaterial
          color="#222222"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      {/* Amber seam strips */}
      {seamPositions.map(([x, y, z], i) => (
        <mesh
          key={i}
          position={[x, y, z]}
          ref={el => { if (el) seamRefs.current[i] = el; }}
        >
          <boxGeometry args={[3.8, 0.07, 0.01]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.primary}
            emissive={PILLAR.INDUSTRIAL.primary}
            emissiveIntensity={0.7}
            metalness={0.5}
            roughness={0.1}
          />
        </mesh>
      ))}

      {/* Central lock housing — industrial circle */}
      <mesh position={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.55, 0.55, 0.12, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* Lock rings — biomechanical counter-rotation */}
      <group position={[0, 0, 0.32]}>
        <LockRing radius={0.40} speed={ 0.45} color={PILLAR.INDUSTRIAL.primary} />
        <LockRing radius={0.60} speed={-0.28} color={PILLAR.BIOLOGICAL.accent} />
        <LockRing radius={0.78} speed={ 0.18} color={PILLAR.INDUSTRIAL.accent} />
      </group>
    </group>
  );
}

// ── Ambient spore particles — BIOLOGICAL contamination ────────────────────────
function SporeField() {
  return (
    <Sparkles
      count={200}
      scale={[8, 9, 6]}
      size={0.8}
      speed={0.15}
      opacity={0.55}
      color={PILLAR.BIOLOGICAL.highlight}
      noise={0.4}
    />
  );
}

// ── Reactor point light — flicker ─────────────────────────────────────────────
function ReactorLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    lightRef.current.intensity = 1.8 + 0.8 * Math.sin(t * 3.1) + 0.3 * Math.sin(t * 7.3);
  });
  return (
    <pointLight
      ref={lightRef}
      position={[0, 0, -2]}
      color={PILLAR.INDUSTRIAL.primary}
      intensity={1.8}
      distance={12}
      decay={2}
    />
  );
}

// ── Cinematic camera drift — slow lerp around vault ───────────────────────────
function CameraDrift() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime() * 0.08;
    const targetX = Math.sin(t) * 0.8;
    const targetY = Math.cos(t * 0.7) * 0.3 + 0.2;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.lookAt(0, 0, -4);
  });
  return null;
}

// ── Scene root — exported standalone or embedded in a parent screen ────────────
export function LoginGateScene() {
  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 0.5, 4], fov: 55, near: 0.1, far: 80 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.INDUSTRIAL.surface }}
    >
      {/* Volumetric-style fog — BIOLOGICAL dark forest */}
      <fog attach="fog" args={[PILLAR.BIOLOGICAL.surface, 10, 60]} />

      <Environment preset="night" />

      {/* Static ambient + directional fill */}
      <ambientLight color="#1a2a1a" intensity={0.4} />
      <directionalLight
        position={[2, 5, 2]}
        color={PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a'}
        intensity={0.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <ReactorLight />
      <CameraDrift />
      <VaultDoor />
      <SporeField />
    </Canvas>
  );
}
