// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// CrystalForge scene — CRYSTALLINE + INDUSTRIAL blend.
// Starter tier: cavern, crystal veins, lava river shader, mining machinery.
// Desktop: MeshPhysicalMaterial transmission on veins.
// Mobile fallback: MeshStandardMaterial emissive (no transmission).
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR } from '../../theme/tokens.js';

// ── Platform detection — mobile gets cheaper materials ────────────────────────
const IS_MOBILE = typeof navigator !== 'undefined' &&
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

// ── Lava river shader — scrolling UV noise, emissive gradient ─────────────────
const lavaVert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const lavaFrag = /* glsl */`
uniform float uTime;
varying vec2  vUv;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), f.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
    f.y
  );
}

void main() {
  // Scrolling UV with two noise octaves
  vec2 uv = vUv;
  uv.x += uTime * 0.12;
  float n  = noise(uv * 4.0);
  float n2 = noise(uv * 8.0 + vec2(uTime * 0.08, 0.0));
  float v  = n * 0.65 + n2 * 0.35;

  // Lava color: deep red (#ff3d00) → orange (#ff6d00)
  vec3 cool = vec3(1.0, 0.24, 0.00); // #ff3d00
  vec3 hot  = vec3(1.0, 0.43, 0.00); // #ff6d00
  vec3 col  = mix(cool, hot, v);

  // Emissive intensity driven by noise
  col *= 1.0 + v * 1.4;

  gl_FragColor = vec4(col, 1.0);
}
`;

function LavaRiver({ position }: { position: [number, number, number] }) {
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, dt) => {
    const u = matRef.current?.uniforms['uTime'];
    if (u) u.value += dt;
  });

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[8, 0.6, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={lavaVert}
        fragmentShader={lavaFrag}
        uniforms={uniforms}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── Crystal vein cluster — CylinderGeometry, desktop uses transmission ────────
function CrystalVein({ position, rotation, scale }: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale:    number;
}) {
  return (
    <mesh position={position} rotation={rotation} scale={[scale, scale, scale]} castShadow>
      <cylinderGeometry args={[0.05, 0.18, 1.4, 5, 1]} />
      {IS_MOBILE ? (
        <meshStandardMaterial
          color={PILLAR.CRYSTALLINE.deep}
          emissive={PILLAR.CRYSTALLINE.primary}
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.2}
        />
      ) : (
        <meshPhysicalMaterial
          color={PILLAR.CRYSTALLINE.deep}
          emissive={PILLAR.CRYSTALLINE.primary}
          emissiveIntensity={0.3}
          transmission={0.78}
          thickness={1.5}
          roughness={0.02}
          metalness={0.0}
          ior={1.7}
        />
      )}
    </mesh>
  );
}

// ── Mining piston — BoxGeometry animated Y via useFrame ───────────────────────
function MiningPiston({ position }: { position: [number, number, number] }) {
  const pistonRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!pistonRef.current) return;
    const t = clock.getElapsedTime();
    // Hydraulic piston motion — asymmetric up/down
    pistonRef.current.position.y = position[1] + Math.abs(Math.sin(t * 1.6)) * -0.5;
  });

  return (
    <group>
      {/* Fixed housing */}
      <mesh position={position} castShadow>
        <boxGeometry args={[0.22, 0.4, 0.22]} />
        <meshStandardMaterial
          color={PILLAR.INDUSTRIAL.surface}
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>
      {/* Moving piston rod */}
      <group ref={pistonRef} position={[position[0], position[1], position[2]]}>
        <mesh position={[0, -0.55, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a'}
            metalness={0.95}
            roughness={0.15}
          />
        </mesh>
        {/* Drill head */}
        <mesh position={[0, -0.95, 0]} castShadow>
          <coneGeometry args={[0.10, 0.25, 8]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.highlight}
            emissive={PILLAR.INDUSTRIAL.accent}
            emissiveIntensity={0.4}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── Cavern ceiling — inverted sphere ─────────────────────────────────────────
function Cavern() {
  return (
    <>
      {/* Ceiling dome */}
      <mesh scale={[1, -0.6, 1]} position={[0, 3.5, 0]}>
        <sphereGeometry args={[7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={PILLAR.CRYSTALLINE.surface}
          roughness={1.0}
          metalness={0.0}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, 0]} receiveShadow>
        <planeGeometry args={[14, 12, 1, 1]} />
        <meshStandardMaterial
          color="#0f0008"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
    </>
  );
}

// ── UV atmospheric light ──────────────────────────────────────────────────────
function AtmosphericLight() {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.intensity = 1.8 + 0.6 * Math.sin(t * 0.9);
  });
  return (
    <pointLight
      ref={ref}
      position={[0, 1.5, 0]}
      color={PILLAR.CRYSTALLINE.primary}
      intensity={1.8}
      distance={12}
      decay={2}
    />
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function CrystalForgeScene() {
  // Crystal vein positions — deterministic, no Math.random()
  const veins: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }> = useMemo(() => [
    { position: [-2.5,  0.2, -1.5], rotation: [0.3,  0,  0.4], scale: 1.2 },
    { position: [-1.8,  0.8, -2.0], rotation: [0.1,  0,  0.7], scale: 0.9 },
    { position: [ 2.2,  0.0, -1.0], rotation: [-0.2, 0, -0.5], scale: 1.4 },
    { position: [ 1.5,  0.6, -2.2], rotation: [0.5,  0, -0.3], scale: 0.8 },
    { position: [-0.5,  0.4, -2.5], rotation: [0.2,  0,  0.1], scale: 1.0 },
    { position: [ 0.8, -0.2, -1.8], rotation: [0.6,  0,  0.3], scale: 0.75 },
    { position: [-3.0,  0.5, -0.5], rotation: [0.0,  0,  0.8], scale: 1.1 },
    { position: [ 3.0,  0.3, -0.8], rotation: [0.1,  0, -0.6], scale: 1.3 },
  ], []);

  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 1.2, 6], fov: 55, near: 0.1, far: 50 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.CRYSTALLINE.surface }}
    >
      {/* UV atmospheric fog */}
      <fog attach="fog" args={['#3d007a', 2, 25]} />

      <Environment preset="night" />
      <ambientLight color="#0d0018" intensity={0.4} />
      <AtmosphericLight />
      {/* Lava glow from below */}
      <pointLight position={[0, -1.4, 0]} color="#ff6d00" intensity={2.5} distance={6} decay={2} />

      <Cavern />

      {/* Lava rivers at floor level */}
      <LavaRiver position={[ 2.0, -1.55, 0]} />
      <LavaRiver position={[-2.0, -1.55, 0]} />

      {/* Crystal vein clusters */}
      {veins.map((v, i) => (
        <CrystalVein key={i} position={v.position} rotation={v.rotation} scale={v.scale} />
      ))}

      {/* Mining pistons */}
      <MiningPiston position={[-1.2, 1.0, 0]} />
      <MiningPiston position={[ 1.2, 1.0, 0]} />
      <MiningPiston position={[ 0.0, 1.0, 1.0]} />

      {/* Crystal dust particles */}
      <Sparkles
        count={80}
        scale={[6, 4, 4]}
        size={0.6}
        speed={0.1}
        opacity={0.4}
        color={PILLAR.CRYSTALLINE.accent}
        noise={0.8}
      />
    </Canvas>
  );
}
