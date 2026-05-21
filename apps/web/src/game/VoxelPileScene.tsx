// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useMemo, useState, type MutableRefObject } from 'react';

// Module-level xorshift32 — replaces vRng() for visual effects.
// Seeded from crypto entropy so each session looks distinct, but never
// touches the Sacred Core CSPRNG used for game logic.
let _vr = (typeof crypto !== 'undefined' ? crypto.getRandomValues(new Uint32Array(1))[0]! : 0xdeadbeef) || 0xdeadbeef;
const vRng = () => { _vr ^= _vr << 13; _vr ^= _vr >>> 17; _vr ^= _vr << 5; return (_vr >>> 0) / 4294967296; };
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Environment, Sparkles, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
// r3f-perf — dev-only baseline profiler (tree-shaken in prod by Vite)
import { Perf } from 'r3f-perf';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useFarkleStore } from '../store/farkleStore.js';
import type { FarkleBody } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import type { ExplosionEvent } from '../store/explosionStore.js';
import { playCollisionImpact } from '../audio/gameAudio.js';
import { OV } from '../theme/tokens.js';

// Organic Vegas 1.0 — neon pip colors on dark obsidian body
const FACE_COLOR: Record<number, string> = {
  1: '#ff2244',
  2: '#ff7700',
  3: '#ffe000',
  4: '#00ff66',
  5: '#00aaff',
  6: '#cc44ff',
};

// Standard Western die: when face F is on front (+z), these are the top and right faces.
// Opposite faces always sum to 7: (1,6) (2,5) (3,4)
const FACE_SIDES: Record<number, { top: number; right: number }> = {
  1: { top: 2, right: 3 },
  2: { top: 3, right: 6 },
  3: { top: 1, right: 2 },
  4: { top: 2, right: 1 },
  5: { top: 1, right: 3 },
  6: { top: 2, right: 4 },
};

// Organic Vegas 1.0 — obsidian body + neon glowing pip textures.
// Dark body with neon pip glow matching the face's identity color.
const _dieFaceTexCache = new Map<number, THREE.CanvasTexture>();

function getDieFaceTex(face: number): THREE.CanvasTexture {
  if (_dieFaceTexCache.has(face)) return _dieFaceTexCache.get(face)!;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const pipColor = FACE_COLOR[face] ?? '#00e5ff';

  // Obsidian base — void-black with subtle cool-dark gradient
  const bg = ctx.createRadialGradient(size * 0.42, size * 0.38, 0, size / 2, size / 2, size * 0.78);
  bg.addColorStop(0, '#16121f');
  bg.addColorStop(0.6, '#0e0b16');
  bg.addColorStop(1, '#07050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle corner vignette — deep black at edges
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  // Neon edge catch — very faint color tint on border (light source)
  ctx.strokeStyle = pipColor + '28';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);

  // Neon glowing pips
  const pips = PIP_POS[face] ?? [];
  const pipR = 30;
  pips.forEach(([px, py]) => {
    const x = size / 2 + px * 660;
    const y = size / 2 - py * 660;

    // Wide outer bloom halo
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, pipR * 3.5);
    bloom.addColorStop(0, pipColor + '50');
    bloom.addColorStop(0.4, pipColor + '22');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, pipR * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = bloom;
    ctx.fill();

    // Mid glow ring
    const mid = ctx.createRadialGradient(x, y, pipR * 0.5, x, y, pipR * 1.8);
    mid.addColorStop(0, pipColor + 'aa');
    mid.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, pipR * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = mid;
    ctx.fill();

    // Hot white-to-color pip core
    const core = ctx.createRadialGradient(x - pipR * 0.22, y - pipR * 0.22, 0, x, y, pipR);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.25, pipColor);
    core.addColorStop(1, pipColor + 'cc');
    ctx.beginPath();
    ctx.arc(x, y, pipR, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  _dieFaceTexCache.set(face, tex);
  return tex;
}

const COLUMN_X = [-2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4];
const OVERFLOW_Y = 8.0;

const CHAINABLE = new Set(['die', 'wild', 'mirror', 'catalyst']);
const TAPPABLE = new Set(['sphere', 'bomb', 'rainbow_bomb', 'multiplier_orb', 'ghost']);

// ── Physics Impact Listener ───────────────────────────────────────────────────
// Reads body positions each render frame, derives apparent y-velocity, and
// fires playCollisionImpact when a falling body suddenly decelerates (impact).
// Pure read — no writes to the store, no changes to physics or sacred files.

interface BodyKinematic { y: number; vy: number; }

// Min gap between collision sounds — prevents audio spam with many bodies in flight
const COLLISION_AUDIO_THROTTLE_MS = 120;

function PhysicsImpactListener() {
  const bodies    = useFarkleStore(s => s.bodies);
  const gamePhase = useFarkleStore(s => s.gamePhase);
  const kinematics = useRef<Map<string, BodyKinematic>>(new Map());
  const lastImpactAt = useRef(0);

  useFrame((_, delta) => {
    if (gamePhase !== 'playing' || delta <= 0) return;

    const map = kinematics.current;
    const activeIds = new Set<string>();
    const now = Date.now();

    for (const body of bodies) {
      activeIds.add(body.id);
      const currY = body.position.y;
      const prev  = map.get(body.id);

      if (prev !== undefined) {
        const currVy = (currY - prev.y) / delta;
        const prevVy = prev.vy;

        // Detect impact: body was falling at >= 1.5 m/s and suddenly decelerated
        if (prevVy < -1.5 && currVy > prevVy + 1.0) {
          if (now - lastImpactAt.current >= COLLISION_AUDIO_THROTTLE_MS) {
            const deltaV   = currVy - prevVy;
            const magnitude = Math.min(1, deltaV / 14);
            playCollisionImpact(magnitude);
            lastImpactAt.current = now;
          }
        }

        map.set(body.id, { y: currY, vy: currVy });
      } else {
        map.set(body.id, { y: currY, vy: 0 });
      }
    }

    // Prune entries for bodies that have left the board
    for (const id of map.keys()) {
      if (!activeIds.has(id)) map.delete(id);
    }
  });

  return null;
}

// ── Camera ────────────────────────────────────────────────────────────────────

// Home position: z=5.5 fills screen with large readable dice
const CAM_HOME = { x: 0, y: 2.0, z: 5.5 };
const CAM_LOOK = new THREE.Vector3(0, 5.0, 0);

function CameraRig() {
  const { camera } = useThree();
  const farkleCount = useFarkleStore(s => s.farkleCount);
  const prevFarkle  = useRef(farkleCount);

  // Spring state — target + current velocity per axis
  const posRef = useRef({ x: CAM_HOME.x, y: CAM_HOME.y, z: CAM_HOME.z });
  const velRef = useRef({ x: 0, y: 0, z: 0 });
  const tgtRef = useRef({ x: CAM_HOME.x, y: CAM_HOME.y, z: CAM_HOME.z });

  useEffect(() => {
    camera.position.set(CAM_HOME.x, CAM_HOME.y, CAM_HOME.z);
    camera.lookAt(CAM_LOOK);
  }, [camera]);

  // Farkle detected — impulse: pull back + drop slightly (physical reality reasserts)
  useEffect(() => {
    const fired = farkleCount > prevFarkle.current;
    prevFarkle.current = farkleCount;
    if (!fired) return;
    tgtRef.current = { x: CAM_HOME.x, y: CAM_HOME.y - 0.35, z: CAM_HOME.z + 0.7 };
    const id = window.setTimeout(() => {
      tgtRef.current = { x: CAM_HOME.x, y: CAM_HOME.y, z: CAM_HOME.z };
    }, 500);
    return () => window.clearTimeout(id);
  }, [farkleCount]);

  useFrame((_, dt) => {
    const stiffness = 120;
    const damping   = 14;
    const pos = posRef.current;
    const vel = velRef.current;
    const tgt = tgtRef.current;

    for (const axis of ['x', 'y', 'z'] as const) {
      const force  = (tgt[axis] - pos[axis]) * stiffness - vel[axis] * damping;
      vel[axis]   += force * dt;
      pos[axis]   += vel[axis] * dt;
    }

    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(CAM_LOOK);
  });

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
        <meshStandardMaterial color={OV.neural} />
      </mesh>
      {[-2.8, -2.0, -1.2, -0.4, 0.4, 1.2, 2.0, 2.8].map((x, i) => (
        <mesh key={i} position={[x, 5, 0]}>
          <boxGeometry args={[0.04, 12, 0.8]} />
          <meshStandardMaterial color={OV.goldDim} opacity={0.5} transparent />
        </mesh>
      ))}
      {COLUMN_X.map((x, i) => {
        const isOverflowing = (columnMaxY[i] ?? 0) > OVERFLOW_Y;
        return (
          <mesh key={i} position={[x, 5, -0.1]}>
            <boxGeometry args={[0.85, 12, 0.1]} />
            <meshStandardMaterial
              color={isOverflowing ? OV.magenta : OV.void}
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

// ── Chain confirm burst — Sparkles at chain tail on length increase ───────────
function ChainConfirmBurst() {
  const chain  = useFarkleStore(s => s.chain);
  const bodies = useFarkleStore(s => s.bodies);
  const prevLen = useRef(0);
  const [burst, setBurst] = useState<{ pos: [number,number,number]; key: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const len = chain.length;
    if (len > prevLen.current && len >= 2) {
      const tailId = chain[len - 1];
      const body   = tailId ? bodies.find(b => b.id === tailId) : undefined;
      const pos: [number,number,number] = body
        ? [body.position.x, body.position.y, body.position.z]
        : [0, 2, 0];
      setBurst({ pos, key: Date.now() });
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setBurst(null), 600);
    }
    prevLen.current = len;
    return () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); };
  }, [chain, bodies]);

  if (!burst) return null;

  return (
    <Sparkles
      key={burst.key}
      position={burst.pos}
      count={28}
      scale={0.9}
      size={0.8}
      speed={1.4}
      opacity={0.75}
      color={OV.cyan}
      noise={0.6}
    />
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

// Shared rounded geometry instance — 0.88³ cube, radius=0.09 bevel, 3 segments per face
const _roundedDieGeom = new RoundedBoxGeometry(0.88, 0.88, 0.88, 3, 0.09);

// ── Multiplier Orb geometry (module-level singletons — created once) ──────────
const _orbGeom     = new THREE.OctahedronGeometry(0.44, 0);
const _orbEdges    = new THREE.EdgesGeometry(_orbGeom);
const _ORB_ARC_COUNT = 4;

// ── Bush sphere geometry ───────────────────────────────────────────────────────
const _bushGeom = new THREE.IcosahedronGeometry(0.44, 1);

// ── BushSphere — matte flat-shaded foliage ball ───────────────────────────────
function BushSphere({ preDestroyGlow }: { preDestroyGlow: boolean }) {
  const rollRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!rollRef.current) return;
    rollRef.current.rotation.x += delta * 2.1;
    rollRef.current.rotation.z += delta * 1.3;
  });

  return (
    <group ref={rollRef}>
      {/* Dark shadow shell for depth under foliage */}
      <mesh scale={1.14} geometry={_bushGeom}>
        <meshStandardMaterial
          color="#0f2a07"
          roughness={0.99}
          metalness={0.0}
          flatShading
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Main bush — flat-shaded icosahedron gives leafy facet clusters */}
      <mesh castShadow geometry={_bushGeom}>
        <meshStandardMaterial
          color={preDestroyGlow ? '#cc3300' : '#2e7518'}
          emissive={preDestroyGlow ? '#ff0000' : '#071a03'}
          emissiveIntensity={preDestroyGlow ? 1.5 : 0.06}
          roughness={0.97}
          metalness={0.0}
          flatShading
        />
      </mesh>
    </group>
  );
}

// ── MultiplierOrb — electric plasma octahedron ───────────────────────────────
function MultiplierOrb({ preDestroyGlow }: { preDestroyGlow: boolean }) {
  const orbGroupRef = useRef<THREE.Group>(null);
  const arcGeoRef   = useRef<THREE.BufferGeometry>(null);
  const t           = useRef(0);
  const arcTimer    = useRef(0);

  const arcPositions = useMemo(() => new Float32Array(_ORB_ARC_COUNT * 2 * 3), []);

  useFrame((_, delta) => {
    t.current        += delta;
    arcTimer.current += delta;

    if (orbGroupRef.current) {
      orbGroupRef.current.rotation.x = t.current * 1.9;
      orbGroupRef.current.rotation.y = t.current * 1.3;
      orbGroupRef.current.rotation.z = t.current * 0.8;
    }

    // Plasma arcs at ~12fps — cheap flat line updates
    if (arcTimer.current >= 0.083 && arcGeoRef.current) {
      arcTimer.current = 0;
      const attr = arcGeoRef.current.attributes['position'] as THREE.BufferAttribute;
      const pos  = attr.array as Float32Array;
      const seed = Math.floor(t.current * 12);
      for (let i = 0; i < _ORB_ARC_COUNT; i++) {
        const s  = seed * _ORB_ARC_COUNT + i;
        const r  = 0.46;
        const t1 = ((s * 2.399 + i * 1.1) % 1) * Math.PI * 2;
        const p1 = ((s * 1.618 + i * 0.4) % 1) * Math.PI;
        const t2 = ((s * 1.732 + i * 0.9) % 1) * Math.PI * 2;
        const p2 = ((s * 2.236 + i * 0.6) % 1) * Math.PI;
        pos[i*6]   = r * Math.sin(p1) * Math.cos(t1);
        pos[i*6+1] = r * Math.cos(p1);
        pos[i*6+2] = r * Math.sin(p1) * Math.sin(t1);
        pos[i*6+3] = r * Math.sin(p2) * Math.cos(t2);
        pos[i*6+4] = r * Math.cos(p2);
        pos[i*6+5] = r * Math.sin(p2) * Math.sin(t2);
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Cheap BackSide glow shell — no extra light needed */}
      <mesh scale={1.45}>
        <octahedronGeometry args={[0.44, 0]} />
        <meshBasicMaterial color="#0088ff" transparent opacity={0.09} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      {/* Octahedron + edges co-rotate */}
      <group ref={orbGroupRef}>
        <mesh geometry={_orbGeom}>
          <meshStandardMaterial
            color="#6611bb"
            emissive={preDestroyGlow ? '#ff2200' : '#cc44ff'}
            emissiveIntensity={preDestroyGlow ? 4.0 : 3.2}
            roughness={0.88}
            metalness={0.0}
          />
        </mesh>
        <lineSegments geometry={_orbEdges}>
          <lineBasicMaterial color={preDestroyGlow ? '#ff6600' : '#aaeeff'} transparent opacity={0.95} />
        </lineSegments>
      </group>
      {/* Plasma arc discharge */}
      <lineSegments>
        <bufferGeometry ref={arcGeoRef}>
          <bufferAttribute attach="attributes-position" count={_ORB_ARC_COUNT * 2} array={arcPositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#88ddff" transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
}

// ── Lava Dice Shader ──────────────────────────────────────────────────────────
const LavaDiceShader = {
  uniforms: {
    uTime:              { value: 0 },
    uPulseSpeed:        { value: 1.5 },
    uLavaColor:         { value: new THREE.Color('#ff3c00') },
    uCoreColor:         { value: new THREE.Color('#ffcc00') },
    uRockColor:         { value: new THREE.Color('#141211') },
    uCrackingIntensity: { value: 0.65 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vModelPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vModelPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uPulseSpeed;
    uniform vec3 uLavaColor;
    uniform vec3 uCoreColor;
    uniform vec3 uRockColor;
    uniform float uCrackingIntensity;
    varying vec3 vNormal;
    varying vec3 vModelPosition;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    float sdCircle(vec2 p, vec2 center, float radius) {
      return length(p - center) - radius;
    }
    float getDicePipsMask(int faceNum, vec2 p, float radius) {
      float d = 1e5;
      vec2 c = vec2(0.0), tl = vec2(-0.23, 0.23), tr = vec2(0.23, 0.23);
      vec2 ml = vec2(-0.23, 0.0), mr = vec2(0.23, 0.0);
      vec2 bl = vec2(-0.23,-0.23), br = vec2(0.23,-0.23);
      if      (faceNum == 1) d = sdCircle(p, c, radius);
      else if (faceNum == 2) d = min(sdCircle(p, tl, radius), sdCircle(p, br, radius));
      else if (faceNum == 3) d = min(sdCircle(p, tl, radius), min(sdCircle(p, c, radius), sdCircle(p, br, radius)));
      else if (faceNum == 4) d = min(min(sdCircle(p, tl, radius), sdCircle(p, tr, radius)), min(sdCircle(p, bl, radius), sdCircle(p, br, radius)));
      else if (faceNum == 5) d = min(min(min(sdCircle(p, tl, radius), sdCircle(p, tr, radius)), min(sdCircle(p, bl, radius), sdCircle(p, br, radius))), sdCircle(p, c, radius));
      else if (faceNum == 6) d = min(min(min(sdCircle(p, tl, radius), sdCircle(p, tr, radius)), min(sdCircle(p, bl, radius), sdCircle(p, br, radius))), min(sdCircle(p, ml, radius), sdCircle(p, mr, radius)));
      return smoothstep(0.02, -0.01, d);
    }
    void main() {
      vec3 absPos = abs(vModelPosition);
      vec2 faceUV = vec2(0.0);
      int faceNum = 1;
      if (absPos.x > absPos.y && absPos.x > absPos.z) {
        faceUV = vModelPosition.zy;
        faceNum = (vModelPosition.x > 0.0) ? 1 : 6;
      } else if (absPos.y > absPos.x && absPos.y > absPos.z) {
        faceUV = vModelPosition.xz;
        faceNum = (vModelPosition.y > 0.0) ? 2 : 5;
      } else {
        faceUV = vModelPosition.xy;
        faceNum = (vModelPosition.z > 0.0) ? 3 : 4;
      }
      float n = noise(faceUV * 14.0 + uTime * 0.1) * 0.5 + noise(faceUV * 28.0 - uTime * 0.05) * 0.25;
      vec2 distortedUV = faceUV + vec2(n * 0.04);
      float pipMask = getDicePipsMask(faceNum, distortedUV, 0.065);
      float ambientCracks = smoothstep(uCrackingIntensity, uCrackingIntensity - 0.04, noise(faceUV * 9.0 + n));
      float totalCrackMask = max(pipMask, ambientCracks * 0.3);
      float distFromCenter = length(vModelPosition);
      float pulse = sin(uTime * uPulseSpeed) * 0.06 + 1.0;
      float coreGlow = smoothstep(0.85, 0.15, distFromCenter) * pulse;
      vec3 magmaColor = mix(uLavaColor, uCoreColor, coreGlow + (pipMask * 0.6));
      vec3 finalColor = mix(uRockColor, magmaColor, totalCrackMask);
      finalColor += uLavaColor * (1.0 - totalCrackMask) * 0.11 * coreGlow;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// ── CatalystBlock — lava rock with glowing cracks ─────────────────────────────
function CatalystBlock({ inChain, preDestroyGlow }: { inChain: boolean; preDestroyGlow: boolean }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(LavaDiceShader.uniforms), []);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms['uTime']!.value             += delta;
    matRef.current.uniforms['uPulseSpeed']!.value        = preDestroyGlow ? 6.0 : inChain ? 3.5 : 1.5;
    matRef.current.uniforms['uCrackingIntensity']!.value = preDestroyGlow ? 0.20 : inChain ? 0.40 : 0.65;
  });

  return (
    <mesh castShadow geometry={_roundedDieGeom}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={LavaDiceShader.vertexShader}
        fragmentShader={LavaDiceShader.fragmentShader}
      />
    </mesh>
  );
}

// ── Wild Dice Shader ──────────────────────────────────────────────────────────
const _isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

const WildDiceShader = {
  uniforms: {
    uTime:              { value: 0 },
    uPulseSpeed:        { value: 1.8 },
    uRockColor:         { value: new THREE.Color('#110f0e') },
    uCrackingIntensity: { value: 0.65 },
    uAudioIntensity:    { value: 0 },
  },
  vertexShader: LavaDiceShader.vertexShader,
  fragmentShader: `
    uniform float uTime;
    uniform float uPulseSpeed;
    uniform vec3  uRockColor;
    uniform float uCrackingIntensity;
    uniform float uAudioIntensity;
    varying vec3 vNormal;
    varying vec3 vModelPosition;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
    }
    vec3 rainbow(float h) {
      vec3 c = mod(h * 6.0 + vec4(0.0, 4.0, 2.0, 0.0).rgb, 6.0);
      return clamp(abs(c - 3.0) - 1.0, 0.0, 1.0);
    }
    void main() {
      vec3 absPos = abs(vModelPosition);
      vec2 faceUV = (absPos.x > absPos.y && absPos.x > absPos.z) ? vModelPosition.zy :
                    (absPos.y > absPos.x && absPos.y > absPos.z) ? vModelPosition.xz : vModelPosition.xy;

      float n = noise(faceUV * 12.0 + uTime * 0.1) * 0.5
              + noise(faceUV * 24.0 - uTime * 0.05) * 0.25;

      // Crack network reacts to pulse speed (chain/preDestroy state)
      float pulse = sin(uTime * uPulseSpeed) * 0.04 + 1.0;
      float dynamicThreshold = uCrackingIntensity - (uAudioIntensity * 0.08);
      float ambientCracks = smoothstep(dynamicThreshold, dynamicThreshold - 0.03,
                                       noise(faceUV * 8.0 + n)) * pulse;

      float hue = mod(uTime * 0.15 + length(vModelPosition) * 0.4 + uAudioIntensity * 0.1, 1.0);
      vec3 wildColor = rainbow(hue);

      // HDR white core — values > 1.0 feed bloom if post-processing is active
      vec3 whiteCore = vec3(2.5, 2.5, 2.5);
      float distFromCenter = length(vModelPosition);
      float coreGlow = smoothstep(0.8, 0.1, distFromCenter) * (1.0 + uAudioIntensity * 0.5) * pulse;

      vec3 emissiveColor = mix(wildColor, whiteCore, coreGlow * 0.4);
      vec3 finalColor    = mix(uRockColor, emissiveColor, ambientCracks);
      finalColor += wildColor * (1.0 - ambientCracks) * 0.15 * coreGlow;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// ── Wild Fresnel Shader — trapped-rainbow glow shell ─────────────────────────
const WildFresnelShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal  = normalize(normalMatrix * normal);
      vec4 mv  = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    vec3 rainbow(float h) {
      vec3 c = mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0);
      return clamp(abs(c - 3.0) - 1.0, 0.0, 1.0);
    }
    void main() {
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);
      float hue     = mod(uTime * 0.15 + fresnel * 0.5, 1.0);
      gl_FragColor  = vec4(rainbow(hue), fresnel * 0.42);
    }
  `,
};

// ── WildBlock — rainbow crack rock with Fresnel glow shell ────────────────────
function WildBlock({ inChain, preDestroyGlow }: { inChain: boolean; preDestroyGlow: boolean }) {
  const matRef        = useRef<THREE.ShaderMaterial>(null);
  const fresnelRef    = useRef<THREE.ShaderMaterial>(null);
  const uniforms        = useMemo(() => THREE.UniformsUtils.clone(WildDiceShader.uniforms), []);
  const fresnelUniforms = useMemo(() => THREE.UniformsUtils.clone(WildFresnelShader.uniforms), []);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms['uTime']!.value             += delta;
      matRef.current.uniforms['uPulseSpeed']!.value        = preDestroyGlow ? 7.0 : inChain ? 4.0 : 1.8;
      matRef.current.uniforms['uCrackingIntensity']!.value = preDestroyGlow ? 0.15 : inChain ? 0.35 : 0.65;
    }
    if (fresnelRef.current) {
      fresnelRef.current.uniforms['uTime']!.value += delta;
    }
  });

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={WildDiceShader.vertexShader}
          fragmentShader={WildDiceShader.fragmentShader}
        />
      </mesh>
      {/* Fresnel rainbow glow shell — desktop only, simulates trapped/bent light */}
      {!_isMobile && (
        <mesh scale={1.11} geometry={_roundedDieGeom}>
          <shaderMaterial
            ref={fresnelRef}
            uniforms={fresnelUniforms}
            vertexShader={WildFresnelShader.vertexShader}
            fragmentShader={WildFresnelShader.fragmentShader}
            transparent
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Ice Stone Shader — crystalline SSS blue-grey depth with internal crack glow ─
const IceStoneShader = {
  uniforms: {
    uTime:     { value: 0 },
    uSSS:      { value: new THREE.Color('#7ad8f8') },
    uBase:     { value: new THREE.Color('#0d1a26') },
    uMid:      { value: new THREE.Color('#1e3a52') },
    uRim:      { value: new THREE.Color('#c0f0ff') },
    uInChain:  { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;
    void main() {
      vNormal       = normalize(normalMatrix * normal);
      vModelPosition = position;
      vec4 mv       = modelViewMatrix * vec4(position, 1.0);
      vViewDir      = normalize(-mv.xyz);
      gl_Position   = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3  uSSS;
    uniform vec3  uBase;
    uniform vec3  uMid;
    uniform vec3  uRim;
    uniform float uInChain;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),         hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    void main() {
      vec3 absPos = abs(vModelPosition);
      vec2 faceUV = (absPos.x > absPos.y && absPos.x > absPos.z) ? vModelPosition.zy :
                    (absPos.y > absPos.x && absPos.y > absPos.z) ? vModelPosition.xz : vModelPosition.xy;

      // Layered noise for crystal grain and crack channels
      float n1 = noise(faceUV * 8.0  + uTime * 0.04);
      float n2 = noise(faceUV * 16.0 - uTime * 0.02);
      float n3 = noise(faceUV * 32.0 + uTime * 0.01);
      float grain = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

      // Internal crack glow — SSS light bleeds through fine fracture planes
      float crackThreshold = 0.58;
      float crack = smoothstep(crackThreshold, crackThreshold - 0.06, grain);

      // SSS depth gradient — warmer blue near center
      float depth = smoothstep(0.6, 0.0, length(vModelPosition));
      vec3 bodyColor = mix(uBase, uMid, grain);
      vec3 sssGlow   = uSSS * (depth * 0.65 + crack * 0.8);

      // Fresnel rim — ice-white catch light at silhouette
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.8);
      vec3 rimColor = uRim * fresnel * (0.7 + uInChain * 0.9);

      vec3 finalColor = bodyColor + sssGlow + rimColor;
      // Chain: boost SSS brightness
      finalColor += uSSS * uInChain * 0.45;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// ── IceStoneBlock — crystalline ice specimen with SSS blue/grey depth ─────────
function IceStoneBlock({ inChain, preDestroyGlow }: { inChain: boolean; preDestroyGlow: boolean }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(IceStoneShader.uniforms), []);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms['uTime']!.value    += delta;
    matRef.current.uniforms['uInChain']!.value  = inChain ? 1.0 : 0.0;
    if (preDestroyGlow) {
      matRef.current.uniforms['uSSS']!.value.setStyle('#ff4466');
      matRef.current.uniforms['uRim']!.value.setStyle('#ff0044');
    }
  });

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={IceStoneShader.vertexShader}
          fragmentShader={IceStoneShader.fragmentShader}
        />
      </mesh>
      {/* Ice SSS back-scatter shell */}
      <mesh scale={1.08} geometry={_roundedDieGeom}>
        <meshBasicMaterial
          color={preDestroyGlow ? '#ff2244' : '#7ad8f8'}
          transparent
          opacity={inChain ? 0.18 : 0.07}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// ── Stone Blocker Shader — dark granite with Fresnel neon-rim (Void Glow) ──────
const StoneBlockerShader = {
  uniforms: {
    uTime:    { value: 0 },
    uBase:    { value: new THREE.Color('#0f0c09') },
    uMid:     { value: new THREE.Color('#1e1810') },
    uGrain:   { value: new THREE.Color('#060503') },
    uInChain: { value: 0.0 },
    uHealth:  { value: 1.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;
    void main() {
      vNormal        = normalize(normalMatrix * normal);
      vModelPosition = position;
      vec4 mv        = modelViewMatrix * vec4(position, 1.0);
      vViewDir       = normalize(-mv.xyz);
      gl_Position    = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3  uBase;
    uniform vec3  uMid;
    uniform vec3  uGrain;
    uniform float uInChain;
    uniform float uHealth;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),         hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    void main() {
      vec3 absPos = abs(vModelPosition);
      vec2 faceUV = (absPos.x > absPos.y && absPos.x > absPos.z) ? vModelPosition.zy :
                    (absPos.y > absPos.x && absPos.y > absPos.z) ? vModelPosition.xz : vModelPosition.xy;

      float n1 = noise(faceUV * 10.0);
      float n2 = noise(faceUV * 22.0 + 1.7);
      float grain = n1 * 0.6 + n2 * 0.4;

      // Rock body — obsidian to mid granite, grain darkens it
      vec3 bodyColor = mix(uBase, uMid, grain);
      bodyColor = mix(bodyColor, uGrain, noise(faceUV * 40.0) * 0.3);

      // Fresnel rim — neon cyan (chained) or muted slate (idle)
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 3.2);
      float chainPulse = sin(uTime * 3.0) * 0.15 + 0.85;
      vec3 rimCyan    = vec3(0.0, 0.898, 1.000) * fresnel * uInChain * chainPulse * 1.6;
      vec3 rimIdle    = vec3(0.35, 0.30, 0.40)  * fresnel * (1.0 - uInChain) * 0.4;
      // Health crack glow — cracks illuminate with magenta at low health
      float healthCrack = smoothstep(0.55, 0.45, grain) * (1.0 - uHealth);
      vec3 crackGlow  = vec3(1.0, 0.0, 0.8) * healthCrack * 0.7;

      vec3 finalColor = bodyColor + rimCyan + rimIdle + crackGlow;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// ── StoneBlocker — dark granite void-glow with health cracks ──────────────────
function StoneBlocker({ inChain, preDestroyGlow, health, maxHealth }: {
  inChain: boolean; preDestroyGlow: boolean; health: number; maxHealth: number;
}) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(StoneBlockerShader.uniforms), []);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms['uTime']!.value    += delta;
    matRef.current.uniforms['uInChain']!.value  = inChain ? 1.0 : 0.0;
    matRef.current.uniforms['uHealth']!.value   = maxHealth > 0 ? health / maxHealth : 1.0;
  });

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={StoneBlockerShader.vertexShader}
          fragmentShader={StoneBlockerShader.fragmentShader}
        />
      </mesh>
      {preDestroyGlow && (
        <mesh scale={1.12} geometry={_roundedDieGeom}>
          <meshBasicMaterial color="#ff0044" transparent opacity={0.35} depthWrite={false} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  );
}

// ── Bio-Bomb Shader — obsidian-dark with pulsing neon-red organic veins ────────
const BioBombShader = {
  uniforms: {
    uTime:        { value: 0 },
    uPulseSpeed:  { value: 2.2 },
    uBase:        { value: new THREE.Color('#080508') },
    uVein:        { value: new THREE.Color('#ff0030') },
    uVeinBright:  { value: new THREE.Color('#ff6080') },
    uPreDestroy:  { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;
    void main() {
      vNormal        = normalize(normalMatrix * normal);
      vModelPosition = position;
      vec4 mv        = modelViewMatrix * vec4(position, 1.0);
      vViewDir       = normalize(-mv.xyz);
      gl_Position    = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uPulseSpeed;
    uniform vec3  uBase;
    uniform vec3  uVein;
    uniform vec3  uVeinBright;
    uniform float uPreDestroy;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vModelPosition;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i),         hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    void main() {
      vec3 absPos = abs(vModelPosition);
      vec2 faceUV = (absPos.x > absPos.y && absPos.x > absPos.z) ? vModelPosition.zy :
                    (absPos.y > absPos.x && absPos.y > absPos.z) ? vModelPosition.xz : vModelPosition.xy;

      // Layered organic vein network — slow drift for living tissue feel
      float n1 = noise(faceUV * 6.0  + uTime * 0.07);
      float n2 = noise(faceUV * 13.0 - uTime * 0.04 + n1 * 0.3);
      float n3 = noise(faceUV * 26.0 + uTime * 0.02);
      float veinMap = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;

      // Vein channel — thin bright lines at threshold edges
      float veinThresh = 0.52;
      float veinEdge   = smoothstep(veinThresh + 0.04, veinThresh, veinMap)
                       * smoothstep(veinThresh - 0.10, veinThresh, veinMap);
      // Pulse heartbeat
      float pulse = sin(uTime * uPulseSpeed) * 0.35 + 0.65;
      float prePulse = sin(uTime * uPulseSpeed * 2.5) * 0.45 + 0.55;
      float pulseFactor = mix(pulse, prePulse, uPreDestroy);

      vec3 veinColor = mix(uVein, uVeinBright, veinEdge * pulseFactor);
      vec3 baseColor = uBase * (1.0 - veinEdge * 0.6);

      // Subsurface red bleed in base near veins
      float sss = smoothstep(veinThresh + 0.12, veinThresh, veinMap);
      baseColor += uVein * sss * 0.18 * pulseFactor;

      // Fresnel rim — red-orange bio-energy corona at edges
      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.5);
      vec3 rimColor = mix(uVein, uVeinBright, 0.5) * fresnel * pulseFactor * (0.8 + uPreDestroy * 1.2);

      vec3 finalColor = baseColor + veinColor * veinEdge + rimColor;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
};

// ── BioBombMesh — living obsidian with pulsing neon-red veins ────────────────
function BioBombMesh({ preDestroyGlow }: { preDestroyGlow: boolean }) {
  const matRef   = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => THREE.UniformsUtils.clone(BioBombShader.uniforms), []);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms['uTime']!.value       += delta;
    matRef.current.uniforms['uPulseSpeed']!.value  = preDestroyGlow ? 6.5 : 2.2;
    matRef.current.uniforms['uPreDestroy']!.value  = preDestroyGlow ? 1.0 : 0.0;
  });

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={BioBombShader.vertexShader}
          fragmentShader={BioBombShader.fragmentShader}
        />
      </mesh>
      {/* Red bio-aura halo */}
      <mesh scale={1.15} geometry={_roundedDieGeom}>
        <meshBasicMaterial
          color="#ff0030"
          transparent
          opacity={preDestroyGlow ? 0.28 : 0.09}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// ── DieCube — rounded 6-face cube die ────────────────────────────────────────
// BoxGeometry material slot order: [+x(right), -x(left), +y(top), -y(bottom), +z(front), -z(back)]
// Returns which face number (1–6) is pointing up in world space.
// Used by the single-mesh face-tracking system for score/identity display.
function getUpwardFace(face: number, rotation: { x: number; y: number; z: number; w: number }): number {
  const { top, right } = FACE_SIDES[face] ?? { top: 2, right: 3 };
  const bottom = 7 - top;
  const back   = 7 - face;
  const left   = 7 - right;

  const dirToFace: Array<[THREE.Vector3, number]> = [
    [new THREE.Vector3( 1, 0, 0), right],
    [new THREE.Vector3(-1, 0, 0), left],
    [new THREE.Vector3( 0, 1, 0), top],
    [new THREE.Vector3( 0,-1, 0), bottom],
    [new THREE.Vector3( 0, 0, 1), face],
    [new THREE.Vector3( 0, 0,-1), back],
  ];

  const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
  const worldUp = new THREE.Vector3(0, 1, 0);
  let bestFace = top;
  let bestDot  = -Infinity;
  for (const [dir, f] of dirToFace) {
    const dot = dir.clone().applyQuaternion(quat).dot(worldUp);
    if (dot > bestDot) { bestDot = dot; bestFace = f; }
  }
  return bestFace;
}

function DieCube({ face, inChain }: { face: number; inChain: boolean }) {
  const { top, right } = FACE_SIDES[face] ?? { top: 2, right: 3 };
  const bottom = 7 - top;
  const back   = 7 - face;
  const left   = 7 - right;
  const slots  = [right, left, top, bottom, face, back];
  const pipColor = FACE_COLOR[face] ?? '#00e5ff';

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        {slots.map((fv, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={getDieFaceTex(fv)}
            roughness={0.12}
            metalness={0.78}
            envMapIntensity={1.4}
            emissive={inChain ? (FACE_COLOR[fv] ?? '#ffffff') : '#000000'}
            emissiveIntensity={inChain ? 0.9 : 0}
          />
        ))}
      </mesh>
      {/* Neon glow rim — front face color bleeds outward when chained */}
      {inChain && (
        <mesh scale={[1.10, 1.10, 1.10]} geometry={_roundedDieGeom}>
          <meshBasicMaterial
            color={pipColor}
            transparent
            opacity={0.18}
            depthWrite={false}
            side={THREE.BackSide}
          />
        </mesh>
      )}
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
        color: '#bfdfff', emissive: '#3b82f6', emissiveIntensity: 0.25,
        label: '*', labelColor: '#e0f2fe',
        shape: 'box', opacity: 0.70,
      };
    case 'lock':
      return {
        color: body.health > 0 ? '#4b5563' : '#9ca3af',
        emissive: body.health > 0 ? '#1c1f2e' : '#374151',
        emissiveIntensity: 0.15,
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
        color: '#5c5650', emissive: '#2a1f1a', emissiveIntensity: 0,
        label: String(body.health),
        labelColor: '#d6cfc8',
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
      arr[i * 3]     = (vRng() - 0.5) * 0.45;
      arr[i * 3 + 1] = -0.45 - vRng() * 0.25;
      arr[i * 3 + 2] = (vRng() - 0.5) * 0.45;
    }
    return arr;
  }, []);

  const lifetimes = useRef(Float32Array.from({ length: SMOKE_COUNT }, () => vRng()));
  const vels = useRef((() => {
    const a = new Float32Array(SMOKE_COUNT * 3);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      a[i * 3]     = (vRng() - 0.5) * 0.45;
      a[i * 3 + 1] = -0.35 - vRng() * 0.25;
      a[i * 3 + 2] = (vRng() - 0.5) * 0.45;
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
      lt[i] = (lt[i] ?? 0) + delta * (0.45 + vRng() * 0.45);
      if ((lt[i] ?? 0) >= 1) {
        lt[i] = 0;
        pos[i * 3]     = (vRng() - 0.5) * 0.4;
        pos[i * 3 + 1] = -0.45;
        pos[i * 3 + 2] = (vRng() - 0.5) * 0.4;
        vel[i * 3]     = (vRng() - 0.5) * 0.45;
        vel[i * 3 + 1] = -0.35 - vRng() * 0.25;
        vel[i * 3 + 2] = (vRng() - 0.5) * 0.45;
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
  const chainZRef  = useRef(0);
  const _q1        = useRef(new THREE.Quaternion());
  const _q2        = useRef(new THREE.Quaternion());
  const _euler     = useRef(new THREE.Euler());
  const vis = getEntityVisual(body);

  const isChainable = CHAINABLE.has(body.entityType) || (body.entityType === 'lock' && body.health === 0);
  const isTappable = TAPPABLE.has(body.entityType);
  const isBomb = body.entityType === 'bomb';
  const isRainbow = body.entityType === 'rainbow_bomb';

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const { position: p, rotation: r } = body;
    animRef.current += delta;

    // Smooth z-lift: chained dice float toward camera
    const targetZ = body.inChain ? 0.65 : 0;
    chainZRef.current += (targetZ - chainZRef.current) * Math.min(1, delta * 9);

    // Y oscillation + lifted position
    const yOsc = body.inChain ? Math.sin(animRef.current * 3.5) * 0.04 : 0;
    groupRef.current.position.set(p.x, p.y + yOsc, p.z + chainZRef.current);

    // Rotation: physics quaternion + zero-gravity tilt when chained
    if (body.inChain) {
      const rx = Math.sin(animRef.current * 1.1) * 0.20;
      const ry = Math.cos(animRef.current * 0.85) * 0.16;
      _euler.current.set(rx, ry, 0);
      _q1.current.set(r.x, r.y, r.z, r.w);
      _q2.current.setFromEuler(_euler.current);
      _q1.current.multiply(_q2.current);
      groupRef.current.quaternion.copy(_q1.current);
    } else {
      groupRef.current.quaternion.set(r.x, r.y, r.z, r.w);
    }

    if (wildRingRef.current) {
      wildRingRef.current.rotation.z = animRef.current * 0.6;
    }

    if (matRef.current && (isBomb || isRainbow)) {
      const t = animRef.current;
      const pulse = (Math.sin(t * 5.5) + 1) * 0.5;
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
      // Release capture so subsequent pointermove events reach other dice for chain extend.
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onChainStart(body.id, body.face ?? 1, body.column);
    },
    // onPointerEnter retained as fast-path; group-level onPointerMove is fallback.
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

  // userData exposes entity metadata to the scene-level onPointerMove fallback picker
  const entityUserData = { bodyId: body.id, face: body.face ?? 1, column: body.column, chainable: isChainable };

  if (body.entityType === 'sphere') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <BushSphere preDestroyGlow={preDestroyGlow} />
      </group>
    );
  }

  if (body.entityType === 'multiplier_orb') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <MultiplierOrb preDestroyGlow={preDestroyGlow} />
      </group>
    );
  }

  if (body.entityType === 'catalyst') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <CatalystBlock inChain={body.inChain} preDestroyGlow={preDestroyGlow} />
      </group>
    );
  }

  if (body.entityType === 'wild') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <WildBlock inChain={body.inChain} preDestroyGlow={preDestroyGlow} />
      </group>
    );
  }

  if (body.entityType === 'ice') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <IceStoneBlock inChain={body.inChain} preDestroyGlow={preDestroyGlow} />
      </group>
    );
  }

  if (body.entityType === 'stone') {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <StoneBlocker
          inChain={body.inChain}
          preDestroyGlow={preDestroyGlow}
          health={body.health}
          maxHealth={3}
        />
        {body.health > 0 && (
          <Text position={[0, 0, 0.46]} fontSize={0.36} color="#d6cfc8"
            anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
            {String(body.health)}
          </Text>
        )}
        <HealthPips health={body.health} max={3} />
      </group>
    );
  }

  if (body.entityType === 'bomb' || body.entityType === 'rainbow_bomb') {
    const isRainbow = body.entityType === 'rainbow_bomb';
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        {isRainbow ? (
          // Rainbow bomb keeps the existing sphere + smoke look
          <>
            <mesh castShadow>
              <sphereGeometry args={[0.43, 16, 16]} />
              <meshStandardMaterial
                ref={matRef as React.Ref<THREE.MeshStandardMaterial>}
                color="#f0ede0"
                emissive="#ffffff"
                emissiveIntensity={0.4}
                roughness={0.2}
                metalness={0.25}
              />
            </mesh>
            <mesh scale={1.18}>
              <sphereGeometry args={[0.43, 12, 12]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} side={THREE.BackSide} />
            </mesh>
          </>
        ) : (
          <BioBombMesh preDestroyGlow={preDestroyGlow} />
        )}
        {preDestroyGlow && (
          <mesh scale={1.25}>
            <sphereGeometry args={[0.43, 10, 10]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.55} depthWrite={false} />
          </mesh>
        )}
        <SmokeParticles rainbow={isRainbow} />
        <BombFuseRing
          spawnedAt={body.spawnedAt}
          fuseMs={3000}
          onExpired={() => onEntityTap(body.id)}
        />
      </group>
    );
  }

  if (vis.shape === 'sphere') {
    const rimColor = isBomb ? '#ff2200' : (isRainbow ? '#ffffff' : vis.emissive);
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
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
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
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

  // Box (die, lock, mirror, catalyst — ice/stone/bomb/wild/sphere handled above)
  const needsHealthPips = body.entityType === 'lock' && body.health > 0;

  // ── Die: full 6-face cube ──────────────────────────────────────────────────
  if (body.entityType === 'die' && body.face != null) {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <DieCube face={body.face} inChain={body.inChain} />
      </group>
    );
  }

  // ── All other box entities (lock, mirror, catalyst) ──────────────────────
  const isShinyBlocker = body.entityType === 'lock';
  const blockerRoughness = 0.08;
  const blockerMetal     = 0.78;

  return (
    <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
      <mesh castShadow {...(isShinyBlocker ? { geometry: _roundedDieGeom } : {})}>
        {!isShinyBlocker && <boxGeometry args={[0.88, 0.88, 0.88]} />}
        <meshStandardMaterial
          ref={matRef}
          color={preDestroyGlow ? '#ff4400' : vis.color}
          emissive={preDestroyGlow ? '#ff0000' : vis.emissive}
          emissiveIntensity={preDestroyGlow ? 1.4 : vis.emissiveIntensity}
          roughness={isShinyBlocker ? blockerRoughness : 0.4}
          metalness={isShinyBlocker ? blockerMetal : 0.15}
          transparent={vis.opacity < 1}
          opacity={vis.opacity}
          envMapIntensity={isShinyBlocker ? 1.5 : 1}
        />
      </mesh>
      {vis.label && (
        <Text position={[0, 0, 0.46]} fontSize={0.36} color={vis.labelColor}
          anchorX="center" anchorY="middle" renderOrder={1} depthOffset={-1}>
          {vis.label}
        </Text>
      )}
      {needsHealthPips && <HealthPips health={body.health} max={3} />}
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
      const angle = vRng() * Math.PI * 2;
      const elev  = (vRng() - 0.35) * Math.PI;
      const spd   = 1.8 + vRng() * 2.8;
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
      camera.position.x = origCam.current.x + (vRng() - 0.5) * shakeMag * 2;
      camera.position.y = origCam.current.y + (vRng() - 0.5) * shakeMag;
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

// ── Chain Drag Controller ─────────────────────────────────────────────────────
// Bypasses R3F's synthetic pointer events (unreliable in Capacitor WebView during
// touch drag) by attaching native touchmove to the canvas DOM element.
// Projects each touch point onto the play plane (z=0) via raycasting, then finds
// the nearest chainable body within a snap radius. O(n) per move event; fast.

function ChainDragController({
  onChainExtend,
  onChainEnd,
  onEmptyTap,
}: {
  onChainExtend: (id: string, face: number, col: number) => void;
  onChainEnd: () => void;
  onEmptyTap?: (col: number) => void;
}) {
  const { gl, camera } = useThree();
  const bodiesRef     = useRef<FarkleBody[]>([]);
  const lastIdRef     = useRef<string | null>(null);
  const dragging      = useRef(false);
  const raycaster     = useRef(new THREE.Raycaster());
  const playPlane     = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const hitPoint      = useRef(new THREE.Vector3());

  // Mirror bodies into a ref so touchmove always sees the latest state without
  // subscribing to React renders.
  useEffect(() =>
    useFarkleStore.subscribe(s => { bodiesRef.current = s.bodies; })
  , []);

  useEffect(() => {
    const canvas = gl.domElement;

    const nearest = (clientX: number, clientY: number): FarkleBody | null => {
      const rect = canvas.getBoundingClientRect();
      const nx   = ((clientX - rect.left) / rect.width)  *  2 - 1;
      const ny   = ((clientY - rect.top)  / rect.height) * -2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      if (!raycaster.current.ray.intersectPlane(playPlane.current, hitPoint.current)) return null;
      const { x: wx, y: wy } = hitPoint.current;
      let best: FarkleBody | null = null;
      let bestDist = 0.65; // snap radius ≈ 70 % of die width
      for (const body of bodiesRef.current) {
        const chainable = CHAINABLE.has(body.entityType) ||
          (body.entityType === 'lock' && body.health === 0);
        if (!chainable) continue;
        const dx = body.position.x - wx;
        const dy = body.position.y - wy;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; best = body; }
      }
      return best;
    };

    const onTouchStart = (e: TouchEvent) => {
      dragging.current  = true;
      lastIdRef.current = null;
      if (!onEmptyTap) return;
      const t = e.touches[0];
      if (!t || nearest(t.clientX, t.clientY)) return; // a die was hit; EntityMesh handles it
      // Empty-space tap: project through camera to find nearest column
      const rect = canvas.getBoundingClientRect();
      const nx = ((t.clientX - rect.left) / rect.width)  *  2 - 1;
      const ny = ((t.clientY - rect.top)  / rect.height) * -2 + 1;
      raycaster.current.setFromCamera(new THREE.Vector2(nx, ny), camera);
      if (!raycaster.current.ray.intersectPlane(playPlane.current, hitPoint.current)) return;
      const wx = hitPoint.current.x;
      let nearestCol = 0; let minDist = Infinity;
      COLUMN_X.forEach((cx, i) => { const d = Math.abs(cx - wx); if (d < minDist) { minDist = d; nearestCol = i; } });
      onEmptyTap(nearestCol);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      if (!t) return;
      const body = nearest(t.clientX, t.clientY);
      if (!body || body.id === lastIdRef.current) return;
      lastIdRef.current = body.id;
      onChainExtend(body.id, body.face ?? 1, body.column);
    };

    const onTouchEnd = () => {
      dragging.current  = false;
      lastIdRef.current = null;
      onChainEnd();
    };

    canvas.addEventListener('touchstart',  onTouchStart, { passive: true });
    canvas.addEventListener('touchmove',   onTouchMove,  { passive: true });
    canvas.addEventListener('touchend',    onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart',  onTouchStart);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [gl, camera, onChainExtend, onChainEnd, onEmptyTap]);

  return null;
}

// ── Candle light — warm flickering point light ────────────────────────────────
function CandleLight({ position, phase = 0 }: { position: [number, number, number]; phase?: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const t = useRef(phase);
  useFrame((_, delta) => {
    t.current += delta;
    if (!lightRef.current) return;
    // Multi-frequency flicker — simulates real candle turbulence
    const flicker =
      Math.sin(t.current * 7.1) * 0.9 +
      Math.sin(t.current * 13.7) * 0.45 +
      Math.sin(t.current * 3.3) * 0.3 +
      Math.sin(t.current * 23.5) * 0.2;
    lightRef.current.intensity = 5.5 + flicker;
  });
  return (
    <pointLight
      ref={lightRef}
      position={position}
      color="#ff9a30"
      intensity={5.5}
      distance={12}
      decay={2}
    />
  );
}

// ── Scene content ─────────────────────────────────────────────────────────────

interface SceneContentProps {
  onChainStart: (id: string, face: number, column: number) => void;
  onChainExtend: (id: string, face: number, column: number) => void;
  onChainEnd: () => void;
  onEntityTap: (id: string) => void;
  onEmptyTap?: (col: number) => void;
}

function SceneContent({ onChainStart, onChainExtend, onChainEnd, onEntityTap, onEmptyTap }: SceneContentProps) {
  const bodies          = useFarkleStore(s => s.bodies);
  const explosions      = useExplosionStore(s => s.explosions);
  const removeExplosion = useExplosionStore(s => s.removeExplosion);
  const highlightedIds  = useExplosionStore(s => s.highlightedBodyIds);
  const highlightedSet  = useMemo(() => new Set(highlightedIds), [highlightedIds]);

  return (
    <group
      onPointerUp={onChainEnd}
      onPointerCancel={onChainEnd}
    >
      <CameraRig />
      <PhysicsImpactListener />
      {/* Environment map — provides specular reflections for MeshStandardMaterial envMapIntensity */}
      <Environment preset="city" />
      {/* Ambient — slightly reduced now that env map contributes */}
      <ambientLight intensity={1.6} color="#8aaabb" />
      {/* KEY LIGHT — warm upper-right-front; primary face shading */}
      <directionalLight position={[6, 8, 7]} intensity={3.5} color="#fff8e0" />
      {/* FILL LIGHT — cool upper-left; softens without flattening */}
      <directionalLight position={[-4, 5, 3]} intensity={1.5} color="#c8dde8" />
      {/* Single animated candle — center position, merged from three for mobile draw-call budget */}
      <CandleLight position={[0.0, 2.5, 3.5]} phase={1.7} />
      {/* Warm backfill — rear face edge definition */}
      <pointLight position={[0, 5, -3]} intensity={1.5} color="#ff7a20" distance={14} decay={2} />
      <ColumnGrid />
      <ContactShadows
        position={[0, -0.09, 0]}
        opacity={0.45}
        scale={10}
        blur={1.8}
        far={6}
        color={OV.void}
      />
      <DoublerCellPanels />
      <ChainLine />
      <ChainConfirmBurst />
      <RallyTimerOrb />
      <ChainDragController onChainExtend={onChainExtend} onChainEnd={onChainEnd} {...(onEmptyTap !== undefined ? { onEmptyTap } : {})} />
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
      <EffectComposer>
        <Bloom
          luminanceThreshold={_isMobile ? 0.85 : 0.75}
          luminanceSmoothing={0.1}
          intensity={_isMobile ? 0.7 : 1.2}
        />
        <Vignette offset={0.35} darkness={_isMobile ? 0.4 : 0.55} eskil={false} />
      </EffectComposer>
    </group>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface VoxelPileSceneProps {
  onChainStart: (id: string, face: number, column: number) => void;
  onChainExtend: (id: string, face: number, column: number) => void;
  onChainEnd: () => void;
  onEntityTap: (id: string) => void;
  onEmptyTap?: (col: number) => void;
}

export function VoxelPileScene({ onChainStart, onChainExtend, onChainEnd, onEntityTap, onEmptyTap }: VoxelPileSceneProps) {
  return (
    <div style={{ width: '100%', height: '100%', background: OV.neural }}>
      <Canvas
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
        camera={{ fov: 75, near: 0.1, far: 100 }}
        gl={{
          antialias: !_isMobile,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      >
        {import.meta.env.DEV && <Perf position="top-right" />}
        <SceneContent
          onChainStart={onChainStart}
          onChainExtend={onChainExtend}
          onChainEnd={onChainEnd}
          onEntityTap={onEntityTap}
          {...(onEmptyTap !== undefined ? { onEmptyTap } : {})}
        />
      </Canvas>
    </div>
  );
}
