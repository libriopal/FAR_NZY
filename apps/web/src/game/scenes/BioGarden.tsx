// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// BioGarden scene — BIOLOGICAL pillar.
// Starter tier: ground plane, plant clusters, breathing shader, ambient spores.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR } from '../../theme/tokens.js';

// ── Breathing ground shader — sin(uTime + vX) vertex pulse ───────────────────
const breathingVert = /* glsl */`
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorldPos;

void main() {
  vUv = uv;
  vec3 pos = position;
  // Slow ground inhale — Y offset scaled to XZ position
  pos.y += sin(uTime * 0.6 + pos.x * 1.2 + pos.z * 0.8) * 0.018
         + cos(uTime * 0.4 + pos.z * 1.5) * 0.010;
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0);
}
`;

const breathingFrag = /* glsl */`
uniform float uTime;
varying vec2  vUv;
varying vec3  vWorldPos;

void main() {
  // Radial moss gradient — brighter emerald at growth rings
  float d  = length(vUv - 0.5) * 2.0;
  float ring = 0.5 + 0.5 * sin(d * 6.0 - uTime * 0.4);
  vec3 base = vec3(0.04, 0.10, 0.04);
  vec3 moss = vec3(0.10, 0.48, 0.29); // PILLAR.BIOLOGICAL.primary
  vec3 col = mix(base, moss, ring * (1.0 - d * 0.6));

  // Vignette edge
  col *= 1.0 - d * 0.5;

  gl_FragColor = vec4(col, 1.0);
}
`;

function BreathingGround() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, dt) => {
    const u = matRef.current?.uniforms['uTime'];
    if (u) u.value += dt;
  });

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
      <planeGeometry args={[20, 20, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={breathingVert}
        fragmentShader={breathingFrag}
        uniforms={uniforms}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Procedural plant stalk — tapered tube ─────────────────────────────────────
function PlantStalk({ position, height, color, phase }: {
  position: [number, number, number];
  height: number;
  color: string;
  phase: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      // Gentle sway — independent phase per plant
      ref.current.rotation.z = Math.sin(t * 0.5 + phase) * 0.04;
      ref.current.rotation.x = Math.cos(t * 0.4 + phase * 1.3) * 0.03;
    }
  });

  return (
    <mesh ref={ref} position={position} castShadow>
      <cylinderGeometry args={[0.04, 0.12, height, 6, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.88}
        metalness={0.0}
      />
    </mesh>
  );
}

// ── Cluster of 3–5 plant stalks ───────────────────────────────────────────────
function PlantCluster({ center, count }: { center: [number, number, number]; count: number }) {
  const plants = useMemo(() => {
    // Deterministic spread from center — no Math.random() in render path
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + i * 0.73;
      const r     = 0.2 + (i % 3) * 0.18;
      const h     = 0.8 + (i % 4) * 0.35;
      const colorOptions: string[] = [
        PILLAR.BIOLOGICAL.primary,
        PILLAR.BIOLOGICAL.accent,
        PILLAR.BIOLOGICAL.highlight,
      ];
      return {
        pos: [
          center[0] + Math.cos(angle) * r,
          center[1],
          center[2] + Math.sin(angle) * r,
        ] as [number, number, number],
        height: h,
        color: colorOptions[i % colorOptions.length] ?? PILLAR.BIOLOGICAL.primary,
        phase: i * 1.17,
      };
    });
  }, [center, count]);

  return (
    <>
      {plants.map((p, i) => (
        <PlantStalk key={i} position={p.pos} height={p.height} color={p.color} phase={p.phase} />
      ))}
    </>
  );
}

// ── Ambient spore drift — upward velocity in useFrame ─────────────────────────
const SPORE_COUNT = 500;

function AmbientSpores() {
  const initialPos = useMemo(() => {
    const pos = new Float32Array(SPORE_COUNT * 3);
    for (let i = 0; i < SPORE_COUNT; i++) {
      const angle = i * 2.399963;
      const r = Math.sqrt(i / SPORE_COUNT) * 9;
      pos[i * 3]     = Math.cos(angle) * r;
      pos[i * 3 + 1] = ((i * 0.137) % 1) * 5 - 1.5;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pos;
  }, []);
  const posRef  = useRef<Float32Array>(initialPos);
  const attrRef = useRef<THREE.BufferAttribute>(null);

  useFrame((_, dt) => {
    const pos = posRef.current;
    for (let i = 0; i < SPORE_COUNT; i++) {
      const yIdx  = i * 3 + 1;
      const yNext = (pos[yIdx] ?? 0) + dt * (0.08 + (i % 7) * 0.012);
      pos[yIdx] = yNext > 4 ? -1.5 : yNext;
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
        color={PILLAR.BIOLOGICAL.accent}
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

// ── Harvest burst — triggered by Zustand harvest event ────────────────────────
// Mount when harvest event fires; unmounts after burst duration.
export function HarvestBurst({ position }: { position: [number, number, number] }) {
  return (
    <Sparkles
      position={position}
      count={80}
      scale={1.5}
      size={1.4}
      speed={2.5}
      opacity={0.85}
      color={PILLAR.BIOLOGICAL.highlight}
      noise={1.2}
    />
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function BioGardenScene() {
  // Five deterministic cluster positions
  const clusters: Array<{ center: [number, number, number]; count: number }> = useMemo(() => [
    { center: [ 1.5, -1.5,  0.5], count: 5 },
    { center: [-2.0, -1.5,  1.0], count: 4 },
    { center: [ 0.2, -1.5, -1.8], count: 5 },
    { center: [-1.0, -1.5, -0.5], count: 3 },
    { center: [ 3.0, -1.5, -2.0], count: 4 },
  ], []);

  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 1.8, 6], fov: 55, near: 0.1, far: 80 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.BIOLOGICAL.surface }}
    >
      {/* Dense biological fog */}
      <fog attach="fog" args={[PILLAR.BIOLOGICAL.surface, 8, 40]} />

      <Environment preset="forest" />

      <ambientLight color={PILLAR.BIOLOGICAL.surface} intensity={0.5} />
      <pointLight
        position={[0, 3, 0]}
        color={PILLAR.BIOLOGICAL.accent}
        intensity={2.0}
        distance={15}
        decay={2}
      />
      <directionalLight
        position={[-3, 6, 2]}
        color={PILLAR.BIOLOGICAL.highlight}
        intensity={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <BreathingGround />

      {clusters.map((c, i) => (
        <PlantCluster key={i} center={c.center} count={c.count} />
      ))}

      <AmbientSpores />
    </Canvas>
  );
}
