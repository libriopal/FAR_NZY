// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFarkleStore } from '../store/farkleStore.js';
import type { FarkleBody } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import type { ExplosionEvent } from '../store/explosionStore.js';

const FACE_COLOR: Record<number, string> = {
  1: '#f43f5e', 2: '#f97316', 3: '#fbbf24',
  4: '#10b981', 5: '#38bdf8', 6: '#7c3aed',
};

const COLUMN_X = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4];
const OVERFLOW_Y = 8.0;

const CHAINABLE = new Set(['die', 'wild', 'mirror', 'catalyst']);
const TAPPABLE = new Set(['sphere', 'bomb', 'rainbow_bomb', 'multiplier_orb', 'ghost']);

// ── Camera ────────────────────────────────────────────────────────────────────

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 4.0, 12);
    camera.lookAt(0, 4.0, 0);
  }, [camera]);
  return null;
}

// ── Column grid ───────────────────────────────────────────────────────────────

function ColumnGrid() {
  const bodies = useFarkleStore(s => s.bodies);

  const columnMaxY = useMemo(() => {
    const maxes = new Array(7).fill(0) as number[];
    for (const b of bodies) {
      const col = b.column;
      if (b.position.y > (maxes[col] ?? 0)) maxes[col] = b.position.y;
    }
    return maxes;
  }, [bodies]);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[8, 0.1, 1.2]} />
        <meshStandardMaterial color="#0d2040" />
      </mesh>
      {[-2.8, -2.0, -1.2, -0.4, 0.4, 1.2, 2.0, 2.8].map((x, i) => (
        <mesh key={i} position={[x, 5, 0]}>
          <boxGeometry args={[0.04, 12, 0.8]} />
          <meshStandardMaterial color="#1a4060" opacity={0.5} transparent />
        </mesh>
      ))}
      {COLUMN_X.map((x, i) => {
        const isOverflowing = (columnMaxY[i] ?? 0) > OVERFLOW_Y;
        return (
          <mesh key={i} position={[x, 5, -0.1]}>
            <boxGeometry args={[0.85, 12, 0.1]} />
            <meshStandardMaterial
              color={isOverflowing ? '#3a0808' : '#0a1628'}
              opacity={isOverflowing ? 0.6 : 0.4}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Doubler Cell Floor Panels ─────────────────────────────────────────────────

function DoublerCellPanels() {
  const doublerCells = useFarkleStore(s => s.doublerCells);
  const now = Date.now();
  const active = doublerCells.filter(d => d.active && d.expiresAt > now);
  if (active.length === 0) return null;
  return (
    <group>
      {active.map(d => {
        const x = COLUMN_X[d.column] ?? 0;
        return (
          <mesh key={d.column} position={[x, 0.06, 0]}>
            <boxGeometry args={[0.85, 0.05, 1.0]} />
            <meshStandardMaterial
              color="#22d3ee"
              emissive="#22d3ee"
              emissiveIntensity={0.8}
              opacity={0.55}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Chain line ────────────────────────────────────────────────────────────────

function ChainLine() {
  const lineRef = useRef<THREE.Line>(null);
  const bodies = useFarkleStore(s => s.bodies);
  const chain = useFarkleStore(s => s.chain);

  useFrame(() => {
    if (!lineRef.current || chain.length < 2) {
      if (lineRef.current) (lineRef.current.geometry as THREE.BufferGeometry).setDrawRange(0, 0);
      return;
    }
    const pts: number[] = [];
    for (const id of chain) {
      const b = bodies.find(x => x.id === id);
      if (b) pts.push(b.position.x, b.position.y, b.position.z);
    }
    const geom = lineRef.current.geometry as THREE.BufferGeometry;
    const attr = geom.getAttribute('position') as THREE.BufferAttribute;
    const needed = pts.length / 3;
    if (attr.count >= needed) {
      attr.set(pts);
      attr.needsUpdate = true;
      geom.setDrawRange(0, needed);
    }
  });

  const maxPoints = 7;
  const positions = useMemo(() => new Float32Array(maxPoints * 3), []);

  return (
    // @ts-ignore — drei/fiber line typing quirk
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={maxPoints} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffd700" linewidth={2} />
    </line>
  );
}

// ── Health pips ───────────────────────────────────────────────────────────────

function HealthPips({ health, max }: { health: number; max: number }) {
  return (
    <group position={[0, -0.26, 0.26]}>
      {Array.from({ length: max }, (_, i) => (
        <mesh key={i} position={[(i - (max - 1) / 2) * 0.22, 0, 0]}>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshStandardMaterial
            color={i < health ? '#ff4040' : '#1a1a2a'}
            emissive={i < health ? '#ff2020' : '#000'}
            emissiveIntensity={i < health ? 0.5 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Die pip layouts ───────────────────────────────────────────────────────────

const PIP_POS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.21, 0.21], [0.21, -0.21]],
  3: [[-0.21, 0.21], [0, 0], [0.21, -0.21]],
  4: [[-0.21, 0.21], [0.21, 0.21], [-0.21, -0.21], [0.21, -0.21]],
  5: [[-0.21, 0.21], [0.21, 0.21], [0, 0], [-0.21, -0.21], [0.21, -0.21]],
  6: [[-0.21, 0.21], [0.21, 0.21], [-0.21, 0], [0.21, 0], [-0.21, -0.21], [0.21, -0.21]],
};

function DiePips({ face, inChain }: { face: number; inChain: boolean }) {
  const pips = PIP_POS[face] ?? [];
  const col = inChain ? '#111111' : '#ffffff';
  return (
    <group position={[0, 0, 0.27]}>
      {pips.map(([px, py], i) => (
        <mesh key={i} position={[px, py, 0]}>
          <circleGeometry args={[0.082, 8]} />
          <meshBasicMaterial color={col} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Entity visual config ──────────────────────────────────────────────────────

interface EntityVisual {
  color: string;
  emissive: string;
  emissiveIntensity: number;
  label: string | null;
  labelColor: string;
  shape: 'box' | 'sphere' | 'ghost';
  opacity: number;
}

function getEntityVisual(body: FarkleBody): EntityVisual {
  const inChain = body.inChain;
  switch (body.entityType) {
    case 'die':
      return {
        color: inChain ? '#ffffff' : (FACE_COLOR[body.face ?? 1] ?? '#7ecfff'),
        emissive: inChain ? (FACE_COLOR[body.face ?? 1] ?? '#7ecfff') : '#000000',
        emissiveIntensity: inChain ? 0.6 : 0,
        label: null,
        labelColor: inChain ? '#000' : '#fff',
        shape: 'box', opacity: 1,
      };
    case 'wild':
      return {
        color: inChain ? '#ffffff' : '#c084fc',
        emissive: '#7c3aed',
        emissiveIntensity: inChain ? 0.8 : 0.3,
        label: 'W',
        labelColor: inChain ? '#3b0764' : '#fff',
        shape: 'box', opacity: 1,
      };
    case 'ice':
      return {
        color: '#93c5fd', emissive: '#1d4ed8', emissiveIntensity: 0.2,
        label: '*', labelColor: '#bfdbfe',
        shape: 'box', opacity: 0.65,
      };
    case 'lock':
      return {
        color: body.health > 0 ? '#374151' : '#6b7280',
        emissive: body.health > 0 ? '#111827' : '#1f2937',
        emissiveIntensity: 0.1,
        label: body.health > 0 ? String(body.health) : null,
        labelColor: '#ff4040',
        shape: 'box', opacity: 1,
      };
    case 'mirror':
      return {
        color: inChain ? '#ffffff' : '#e2e8f0',
        emissive: '#94a3b8',
        emissiveIntensity: inChain ? 0.6 : 0.2,
        label: 'M',
        labelColor: inChain ? '#1e293b' : '#475569',
        shape: 'box', opacity: 1,
      };
    case 'stone':
      return {
        color: '#44403c', emissive: '#1c1917', emissiveIntensity: 0,
        label: String(body.health),
        labelColor: '#a8a29e',
        shape: 'box', opacity: 1,
      };
    case 'bomb':
      return {
        color: '#0a0808', emissive: '#dc2626', emissiveIntensity: 0.5,
        label: null, labelColor: '#fca5a5',
        shape: 'sphere', opacity: 1,
      };
    case 'rainbow_bomb':
      return {
        color: '#f0ede0', emissive: '#ffffff', emissiveIntensity: 0.4,
        label: null, labelColor: '#f9a8d4',
        shape: 'sphere', opacity: 1,
      };
    case 'multiplier_orb':
      return {
        color: '#fbbf24', emissive: '#3b82f6', emissiveIntensity: 0.4,
        label: 'x',
        labelColor: '#1e3a8a',
        shape: 'sphere', opacity: 1,
      };
    case 'ghost':
      return {
        color: '#67e8f9', emissive: '#0891b2', emissiveIntensity: 0.3,
        label: '?',
        labelColor: '#cffafe',
        shape: 'ghost', opacity: 0.4,
      };
    case 'catalyst':
      return {
        color: inChain ? '#ffffff' : '#fb923c',
        emissive: '#c2410c',
        emissiveIntensity: inChain ? 0.6 : 0.3,
        label: 'C',
        labelColor: inChain ? '#431407' : '#fff',
        shape: 'box', opacity: 1,
      };
    case 'sphere':
    default:
      return {
        color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.3,
        label: null, labelColor: '#fff',
        shape: 'sphere', opacity: 1,
      };
  }
}

// ── Bomb smoke particles ──────────────────────────────────────────────────────

const SMOKE_COUNT = 14;

function SmokeParticles({ rainbow = false }: { rainbow?: boolean }) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const timeRef = useRef(0);

  const initPos = useMemo(() => {
    const arr = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 0.45;
      arr[i * 3 + 1] = -0.45 - Math.random() * 0.25;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.45;
    }
    return arr;
  }, []);

  const lifetimes = useRef(Float32Array.from({ length: SMOKE_COUNT }, () => Math.random()));
  const vels = useRef((() => {
    const a = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      a[i * 3]     = (Math.random() - 0.5) * 0.45;
      a[i * 3 + 1] = -0.35 - Math.random() * 0.25;
      a[i * 3 + 2] = (Math.random() - 0.5) * 0.45;
    }
    return a;
  })());

  useFrame((_, delta) => {
    timeRef.current += delta;
    const geo = geoRef.current;
    const mat = matRef.current;
    if (!geo || !mat) return;
    const attr = geo.attributes['position'] as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const pos = attr.array as Float32Array;
    const vel = vels.current;
    const lt = lifetimes.current;

    for (let i = 0; i < SMOKE_COUNT; i++) {
      lt[i] = (lt[i] ?? 0) + delta * (0.45 + Math.random() * 0.45);
      if ((lt[i] ?? 0) >= 1) {
        lt[i] = 0;
        pos[i * 3]     = (Math.random() - 0.5) * 0.4;
        pos[i * 3 + 1] = -0.45;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        vel[i * 3]     = (Math.random() - 0.5) * 0.45;
        vel[i * 3 + 1] = -0.35 - Math.random() * 0.25;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.45;
      } else {
        pos[i * 3]     = (pos[i * 3] ?? 0) + (vel[i * 3] ?? 0) * delta;
        pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + (vel[i * 3 + 1] ?? 0) * delta;
        pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + (vel[i * 3 + 2] ?? 0) * delta;
      }
    }
    attr.needsUpdate = true;
    if (rainbow) mat.color.setHSL((timeRef.current * 0.55) % 1, 1, 0.55);
  });

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" count={SMOKE_COUNT} array={initPos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={rainbow ? '#ff6600' : '#140800'}
        size={0.13}
        transparent
        opacity={0.72}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ── Entity mesh ───────────────────────────────────────────────────────────────

// C10: Bomb fuse countdown ring — color shifts green→red; fires onExpired when fuse hits 0
function BombFuseRing({ spawnedAt, fuseMs, onExpired }: { spawnedAt: number; fuseMs: number; onExpired: () => void }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const expiredRef = useRef(false);

  useFrame(() => {
    if (expiredRef.current) return;
    const elapsed = Date.now() - spawnedAt;
    const remaining = Math.max(0, 1 - elapsed / fuseMs);
    if (remaining <= 0) {
      expiredRef.current = true;
      onExpired();
      return;
    }
    if (matRef.current) {
      // hue: 0.33 (green) → 0.17 (yellow) → 0 (red)
      matRef.current.color.setHSL(remaining * 0.33, 1, 0.52);
      matRef.current.opacity = 0.75 + remaining * 0.2;
    }
  });

  return (
    <mesh rotation={[0, 0, 0]} position={[0, 0, 0.52]}>
      <ringGeometry args={[0.50, 0.62, 48]} />
      <meshBasicMaterial ref={matRef} color="#00ff44" transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface EntityMeshProps {
  body: FarkleBody;
  preDestroyGlow: boolean;
  onChainStart: (id: string, face: number, col: number) => void;
  onChainExtend: (id: string, face: number, col: number) => void;
  onEntityTap: (id: string) => void;
}

function EntityMesh({ body, preDestroyGlow, onChainStart, onChainExtend, onEntityTap }: EntityMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const wildRingRef = useRef<THREE.Mesh>(null);
  const animRef = useRef(0);
  const vis = getEntityVisual(body);

  const isChainable = CHAINABLE.has(body.entityType) || (body.entityType === 'lock' && body.health === 0);
  const isTappable = TAPPABLE.has(body.entityType);
  const isBomb = body.entityType === 'bomb';
  const isRainbow = body.entityType === 'rainbow_bomb';

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const { position: p, rotation: r } = body;
    animRef.current += delta;
    const yOsc = body.inChain ? Math.sin(animRef.current * 4.5) * 0.06 : 0;
    groupRef.current.position.set(p.x, p.y + yOsc, p.z);
    groupRef.current.quaternion.set(r.x, r.y, r.z, r.w);

    if (wildRingRef.current) {
      wildRingRef.current.rotation.z = animRef.current * 0.6;
    }

    if (matRef.current && (isBomb || isRainbow)) {
      const t = animRef.current;
      const pulse = (Math.sin(t * 5.5) + 1) * 0.5; // 0–1, ~2.75 Hz
      if (isBomb) {
        matRef.current.emissiveIntensity = 0.15 + pulse * 1.1;
      } else {
        matRef.current.emissive.setHSL((t * 0.4) % 1, 1, 0.55);
        matRef.current.emissiveIntensity = 0.45 + pulse * 0.55;
      }
    }
  });

  const chainHandlers = isChainable ? {
    onPointerDown: (e: any) => {
      e.stopPropagation();
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onChainStart(body.id, body.face ?? 1, body.column);
    },
    onPointerEnter: (e: any) => {
      e.stopPropagation();
      onChainExtend(body.id, body.face ?? 1, body.column);
    },
  } : isTappable ? {
    onPointerDown: (e: any) => {
      e.stopPropagation();
      onEntityTap(body.id);
    },
  } : {};

  if (vis.shape === 'sphere') {
    const rimColor = isBomb ? '#ff2200' : (isRainbow ? '#ffffff' : vis.emissive);
    return (
      <group ref={groupRef} {...chainHandlers}>
        {/* Core sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.43, 16, 16]} />
          <meshStandardMaterial
            ref={matRef as React.Ref<THREE.MeshStandardMaterial>}
            color={vis.color}
            emissive={vis.emissive}
            emissiveIntensity={vis.emissiveIntensity}
            roughness={0.2}
            metalness={0.25}
          />
        </mesh>
        {/* Fresnel rim glow — BackSide outer shell approximation */}
        {(isBomb || isRainbow) && (
          <mesh scale={1.18}>
            <sphereGeometry args={[0.43, 12, 12]} />
            <meshBasicMaterial
              color={rimColor}
              transparent
              opacity={0.12}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>
        )}
        {/* Pre-destroy glow overlay */}
        {preDestroyGlow && (
          <mesh scale={1.25}>
            <sphereGeometry args={[0.43, 10, 10]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        )}
        {vis.label && (
          <Text position={[0, 0, 0.44]} fontSize={0.28} color={vis.labelColor}
            anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
            {vis.label}
          </Text>
        )}
        {(isBomb || isRainbow) && <SmokeParticles rainbow={isRainbow} />}
        {(isBomb || isRainbow) && (
          <BombFuseRing
            spawnedAt={body.spawnedAt}
            fuseMs={3000}
            onExpired={() => onEntityTap(body.id)}
          />
        )}
      </group>
    );
  }

  if (vis.shape === 'ghost') {
    return (
      <group ref={groupRef} {...chainHandlers}>
        <mesh castShadow>
          <boxGeometry args={[0.88, 0.88, 0.48]} />
          <meshStandardMaterial
            color={vis.color}
            emissive={vis.emissive}
            emissiveIntensity={vis.emissiveIntensity}
            transparent
            opacity={vis.opacity}
            wireframe={false}
          />
        </mesh>
        <lineSegments>
          {/* @ts-ignore */}
          <edgesGeometry args={[new THREE.BoxGeometry(0.88, 0.88, 0.48)]} />
          <lineBasicMaterial color={vis.color} />
        </lineSegments>
        <Text position={[0, 0, 0.26]} fontSize={0.32} color={vis.labelColor}
          anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
          {vis.label}
        </Text>
      </group>
    );
  }

  // Box (die, wild, ice, lock, mirror, stone, bomb, rainbow_bomb, catalyst)
  const needsHealthPips =
    (body.entityType === 'lock' && body.health > 0) ||
    body.entityType === 'stone';
  const maxPips = body.entityType === 'stone' ? 3 : 3;

  return (
    <group ref={groupRef} {...chainHandlers}>
      <mesh castShadow>
        <boxGeometry args={[0.92, 0.92, 0.5]} />
        <meshStandardMaterial
          color={preDestroyGlow ? '#ff4400' : vis.color}
          emissive={preDestroyGlow ? '#ff0000' : vis.emissive}
          emissiveIntensity={preDestroyGlow ? 1.4 : vis.emissiveIntensity}
          roughness={0.4}
          metalness={0.15}
          transparent={vis.opacity < 1}
          opacity={vis.opacity}
        />
      </mesh>
      {body.entityType === 'die' && body.face != null && (
        <DiePips face={body.face} inChain={body.inChain} />
      )}
      {body.entityType === 'wild' && (
        <mesh ref={wildRingRef} position={[0, 0, 0.27]}>
          <ringGeometry args={[0.41, 0.47, 32]} />
          <meshBasicMaterial color="#c084fc" transparent opacity={0.7} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {vis.label && (
        <Text position={[0, 0, 0.26]} fontSize={0.36} color={vis.labelColor}
          anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
          {vis.label}
        </Text>
      )}
      {needsHealthPips && <HealthPips health={body.health} max={maxPips} />}
    </group>
  );
}

// ── Bomb detonation effect ────────────────────────────────────────────────────

const EXP_FLASH_END   = 0.12;  // seconds: solid-flash phase
const EXP_EXPAND_END  = 0.50;  // seconds: expansion+fade phase
const EXP_TOTAL       = 1.30;  // seconds: total including lingering particles
const EXP_PCOUNT      = 28;    // lingering particle count

function BombExplosionEffect({ event, onDone }: { event: ExplosionEvent; onDone: () => void }) {
  const sphereRef  = useRef<THREE.Group>(null);
  const sphMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const geoRef     = useRef<THREE.BufferGeometry>(null);
  const partMatRef = useRef<THREE.PointsMaterial>(null);
  const { camera } = useThree();
  const origCam    = useRef(camera.position.clone());
  const shakeUntil = useRef(performance.now() + (event.type === 'rainbow_bomb' ? 180 : 110));
  const shakeMag   = event.type === 'rainbow_bomb' ? 0.09 : 0.045;

  const isRainbow = event.type === 'rainbow_bomb';
  // For rainbow: visible expansion covers the whole board (~8 world units radius)
  const maxRadius = isRainbow ? 8.0 : 4.5;
  const expColor  = isRainbow ? '#ffffff' : '#ff2200';

  // Particles: init at bomb world pos, fly outward
  const partPos = useMemo(() => {
    const a = new Float32Array(EXP_PCOUNT * 3);
    for (let i = 0; i < EXP_PCOUNT; i++) {
      a[i * 3] = event.x; a[i * 3 + 1] = event.y; a[i * 3 + 2] = event.z;
    }
    return a;
  }, [event.x, event.y, event.z]);

  const partVels = useRef((() => {
    const a = new Float32Array(EXP_PCOUNT * 3);
    for (let i = 0; i < EXP_PCOUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elev  = (Math.random() - 0.35) * Math.PI;
      const spd   = 1.8 + Math.random() * 2.8;
      a[i * 3]     = Math.cos(angle) * Math.cos(elev) * spd;
      a[i * 3 + 1] = Math.sin(elev) * spd;
      a[i * 3 + 2] = Math.sin(angle) * Math.cos(elev) * spd;
    }
    return a;
  })());

  const colorPool = isRainbow
    ? ['#ff0000','#ff8800','#ffff00','#00ff00','#0088ff','#cc00ff']
    : ['#ff6600','#ffdd00','#ff2200','#999999'];
  const partColorIdx = useRef(0);

  useFrame((_, delta) => {
    const elapsed = (performance.now() - event.startTime) / 1000;
    if (elapsed > EXP_TOTAL) { onDone(); return; }

    // ── Camera shake ─────────────────────────────────────────────────────────
    const now = performance.now();
    if (now < shakeUntil.current) {
      camera.position.x = origCam.current.x + (Math.random() - 0.5) * shakeMag * 2;
      camera.position.y = origCam.current.y + (Math.random() - 0.5) * shakeMag;
    } else {
      camera.position.x = origCam.current.x;
      camera.position.y = origCam.current.y;
    }

    // ── Expansion sphere ──────────────────────────────────────────────────────
    const sphere = sphereRef.current;
    const sphMat = sphMatRef.current;
    if (sphere && sphMat) {
      if (elapsed < EXP_FLASH_END) {
        sphere.visible = true;
        sphere.scale.setScalar(1);
        sphMat.opacity = 1.0;
        sphMat.transparent = false;
        if (isRainbow) sphMat.color.setHSL((elapsed * 8) % 1, 1, 0.88);
      } else if (elapsed < EXP_EXPAND_END) {
        const t = (elapsed - EXP_FLASH_END) / (EXP_EXPAND_END - EXP_FLASH_END);
        const eased = 1 - Math.pow(1 - t, 2.5);
        sphere.visible = true;
        sphere.scale.setScalar(1 + (maxRadius / 0.43 - 1) * eased);
        sphMat.transparent = true;
        // Additive blending — higher opacity = brighter glow through scene
        sphMat.opacity = 0.72 * (1 - t);
        if (isRainbow) sphMat.color.setHSL((elapsed * 3) % 1, 1, 0.88);
      } else {
        sphere.visible = false;
      }
    }

    // ── Lingering particles ───────────────────────────────────────────────────
    const geo = geoRef.current;
    const pMat = partMatRef.current;
    if (geo && pMat && elapsed > EXP_FLASH_END * 0.5) {
      const attr = geo.attributes['position'] as THREE.BufferAttribute | undefined;
      if (attr) {
        const pos = attr.array as Float32Array;
        const vel = partVels.current;
        for (let i = 0; i < EXP_PCOUNT; i++) {
          pos[i * 3]     = (pos[i * 3] ?? 0) + (vel[i * 3] ?? 0) * delta;
          pos[i * 3 + 1] = (pos[i * 3 + 1] ?? 0) + (vel[i * 3 + 1] ?? 0) * delta;
          pos[i * 3 + 2] = (pos[i * 3 + 2] ?? 0) + (vel[i * 3 + 2] ?? 0) * delta;
          vel[i * 3 + 1] = (vel[i * 3 + 1] ?? 0) - 3.0 * delta;
        }
        attr.needsUpdate = true;
      }
      const particleAge = Math.max(0, elapsed - EXP_FLASH_END);
      pMat.opacity = Math.max(0, 0.88 * (1 - particleAge / (EXP_TOTAL - EXP_FLASH_END)));

      if (isRainbow) {
        partColorIdx.current = (partColorIdx.current + delta * 5) % colorPool.length;
        pMat.color.set(colorPool[Math.floor(partColorIdx.current) % colorPool.length]!);
      }
    }
  });

  return (
    <group>
      {/* Expansion sphere group — both inner and outer halo scale together */}
      <group ref={sphereRef} position={[event.x, event.y, event.z]}>
        {/* Outer glow halo — softer additive ring for bloom */}
        <mesh scale={1.38}>
          <sphereGeometry args={[0.43, 14, 14]} />
          <meshBasicMaterial
            color={expColor}
            transparent
            opacity={0.28}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Inner expansion sphere */}
        <mesh>
          <sphereGeometry args={[0.43, 20, 20]} />
          <meshBasicMaterial
            ref={sphMatRef as React.Ref<THREE.MeshBasicMaterial>}
            color={expColor}
            transparent
            opacity={0.65}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Lingering particles */}
      <points>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute attach="attributes-position" count={EXP_PCOUNT} array={partPos} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={partMatRef}
          color={isRainbow ? '#ff6600' : '#ff8800'}
          size={0.22}
          transparent
          opacity={0.88}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// ── Rally timer orb ───────────────────────────────────────────────────────────

function RallyTimerOrb() {
  const rallyDecisionActive = useFarkleStore(s => s.rallyDecisionActive);
  const rallyDecisionExpiresAt = useFarkleStore(s => s.rallyDecisionExpiresAt);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const remainingRef = useRef(3);

  useFrame(() => {
    if (!rallyDecisionActive || !rallyDecisionExpiresAt) return;
    const remaining = Math.max(0, (rallyDecisionExpiresAt - Date.now()) / 1000);
    remainingRef.current = remaining;
    const t = remaining / 3;
    if (matRef.current) {
      matRef.current.emissive.setHSL(t * 0.33, 1, 0.5);
      matRef.current.emissiveIntensity = 0.5 + (1 - t) * 0.8;
    }
  });

  if (!rallyDecisionActive) return null;

  return (
    <group position={[0, 9.5, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.55, 20, 20]} />
        <meshStandardMaterial
          ref={matRef}
          color="#ffffff"
          emissive="#00ff88"
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <RallyTimerText expiresAt={rallyDecisionExpiresAt ?? Date.now()} />
    </group>
  );
}

function RallyTimerText({ expiresAt }: { expiresAt: number }) {
  const [label, setLabel] = useState('3.0');
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, (expiresAt - Date.now()) / 1000);
      setLabel(r.toFixed(1));
      if (r <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [expiresAt]);
  return (
    <Text position={[0, 0, 0.58]} fontSize={0.32}
      color="#ffffff" anchorX="center" anchorY="middle"
      renderOrder={2} depthOffset={-1}>
      {label}
    </Text>
  );
}

// ── Scene content ─────────────────────────────────────────────────────────────

interface SceneContentProps {
  onChainStart: (id: string, face: number, column: number) => void;
  onChainExtend: (id: string, face: number, column: number) => void;
  onChainEnd: () => void;
  onEntityTap: (id: string) => void;
}

function SceneContent({ onChainStart, onChainExtend, onChainEnd, onEntityTap }: SceneContentProps) {
  const bodies            = useFarkleStore(s => s.bodies);
  const explosions        = useExplosionStore(s => s.explosions);
  const removeExplosion   = useExplosionStore(s => s.removeExplosion);
  const highlightedIds    = useExplosionStore(s => s.highlightedBodyIds);
  const highlightedSet    = useMemo(() => new Set(highlightedIds), [highlightedIds]);

  return (
    <group
      onPointerUp={() => onChainEnd()}
      onPointerCancel={() => onChainEnd()}
    >
      <CameraRig />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 10, 5]} intensity={0.85} castShadow />
      <pointLight position={[0, 8, 4]} intensity={0.5} color="#3af" />
      <pointLight position={[-4, 2, 2]} intensity={0.3} color="#7c3aed" />
      <pointLight position={[4, 2, 2]} intensity={0.25} color="#4f46e5" />
      <pointLight position={[0, 0, 3]} intensity={0.4} color="#ffffff" />
      <ColumnGrid />
      <DoublerCellPanels />
      <ChainLine />
      <RallyTimerOrb />
      {bodies.map(body => (
        <EntityMesh
          key={body.id}
          body={body}
          preDestroyGlow={highlightedSet.has(body.id)}
          onChainStart={onChainStart}
          onChainExtend={onChainExtend}
          onEntityTap={onEntityTap}
        />
      ))}
      {explosions.map(ev => (
        <BombExplosionEffect
          key={ev.id}
          event={ev}
          onDone={() => removeExplosion(ev.id)}
        />
      ))}
    </group>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface VoxelPileSceneProps {
  onChainStart: (id: string, face: number, column: number) => void;
  onChainExtend: (id: string, face: number, column: number) => void;
  onChainEnd: () => void;
  onEntityTap: (id: string) => void;
}

export function VoxelPileScene({ onChainStart, onChainExtend, onChainEnd, onEntityTap }: VoxelPileSceneProps) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#0a1628', touchAction: 'none' }}
      camera={{ fov: 52, near: 0.1, far: 100 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      dpr={Math.min(window.devicePixelRatio, 2)}
      flat
    >
      <SceneContent
        onChainStart={onChainStart}
        onChainExtend={onChainExtend}
        onChainEnd={onChainEnd}
        onEntityTap={onEntityTap}
      />
    </Canvas>
  );
}
