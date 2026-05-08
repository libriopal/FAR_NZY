// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFarkleStore } from '../store/farkleStore.js';
import type { FarkleBody } from '../store/farkleStore.js';

const FACE_COLOR: Record<number, string> = {
  1: '#f43f5e', 2: '#f97316', 3: '#fbbf24',
  4: '#10b981', 5: '#38bdf8', 6: '#7c3aed',
};

const COLUMN_X = [-3, -2, -1, 0, 1, 2, 3];
const OVERFLOW_Y = 8.0;

const CHAINABLE = new Set(['die', 'wild', 'mirror', 'catalyst']);
const TAPPABLE = new Set(['sphere', 'bomb', 'rainbow_bomb', 'multiplier_orb', 'ghost']);

// ── Camera ────────────────────────────────────────────────────────────────────

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 4.5, 14);
    camera.lookAt(0, 4.5, 0);
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
      {[-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((x, i) => (
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
        label: String(body.face ?? ''),
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
        color: '#111827', emissive: '#dc2626', emissiveIntensity: 0.4,
        label: 'B!',
        labelColor: '#fca5a5',
        shape: 'box', opacity: 1,
      };
    case 'rainbow_bomb':
      return {
        color: '#7c3aed', emissive: '#ec4899', emissiveIntensity: 0.5,
        label: 'RB',
        labelColor: '#f9a8d4',
        shape: 'box', opacity: 1,
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

// ── Entity mesh ───────────────────────────────────────────────────────────────

interface EntityMeshProps {
  body: FarkleBody;
  onChainStart: (id: string, face: number, col: number) => void;
  onChainExtend: (id: string, face: number, col: number) => void;
  onEntityTap: (id: string) => void;
}

function EntityMesh({ body, onChainStart, onChainExtend, onEntityTap }: EntityMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const vis = getEntityVisual(body);

  const isChainable = CHAINABLE.has(body.entityType) || (body.entityType === 'lock' && body.health === 0);
  const isTappable = TAPPABLE.has(body.entityType);

  useFrame(() => {
    if (!groupRef.current) return;
    const { position: p, rotation: r } = body;
    groupRef.current.position.set(p.x, p.y, p.z);
    groupRef.current.quaternion.set(r.x, r.y, r.z, r.w);
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
    return (
      <group ref={groupRef} {...chainHandlers}>
        <mesh castShadow>
          <sphereGeometry args={[0.43, 12, 12]} />
          <meshStandardMaterial
            color={vis.color}
            emissive={vis.emissive}
            emissiveIntensity={vis.emissiveIntensity}
            roughness={0.3}
            metalness={0.3}
          />
        </mesh>
        {vis.label && (
          <Text position={[0, 0, 0.44]} fontSize={0.28} color={vis.labelColor}
            anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
            {vis.label}
          </Text>
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
          color={vis.color}
          emissive={vis.emissive}
          emissiveIntensity={vis.emissiveIntensity}
          roughness={0.4}
          metalness={0.15}
          transparent={vis.opacity < 1}
          opacity={vis.opacity}
        />
      </mesh>
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

// ── Scene content ─────────────────────────────────────────────────────────────

interface SceneContentProps {
  onChainStart: (id: string, face: number, column: number) => void;
  onChainExtend: (id: string, face: number, column: number) => void;
  onChainEnd: () => void;
  onEntityTap: (id: string) => void;
}

function SceneContent({ onChainStart, onChainExtend, onChainEnd, onEntityTap }: SceneContentProps) {
  const bodies = useFarkleStore(s => s.bodies);

  return (
    <group
      onPointerUp={() => onChainEnd()}
      onPointerLeave={() => onChainEnd()}
    >
      <CameraRig />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
      <pointLight position={[0, 8, 4]} intensity={0.5} color="#3af" />
      <pointLight position={[-4, 2, 2]} intensity={0.3} color="#7c3aed" />
      <ColumnGrid />
      <DoublerCellPanels />
      <ChainLine />
      {bodies.map(body => (
        <EntityMesh
          key={body.id}
          body={body}
          onChainStart={onChainStart}
          onChainExtend={onChainExtend}
          onEntityTap={onEntityTap}
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
      camera={{ fov: 50, near: 0.1, far: 100 }}
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
