// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useFarkleStore } from '../store/farkleStore.js';
import type { FarkleBody } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import type { ExplosionEvent } from '../store/explosionStore.js';

const FACE_COLOR: Record<number, string> = {
  1: '#f43f5e', 2: '#f97316', 3: '#fbbf24',
  4: '#10b981', 5: '#38bdf8', 6: '#7c3aed',
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

// Pre-baked canvas textures for each die face (1-6). Created once, never GC'd.
// Colored background (FACE_COLOR) with white pip circles.
const _dieFaceTexCache = new Map<number, THREE.CanvasTexture>();

function getDieFaceTex(face: number): THREE.CanvasTexture {
  if (_dieFaceTexCache.has(face)) return _dieFaceTexCache.get(face)!;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx2d = canvas.getContext('2d')!;

  // Colored background
  ctx2d.fillStyle = FACE_COLOR[face] ?? '#7ecfff';
  ctx2d.fillRect(0, 0, size, size);

  // Subtle warm inner bevel border
  ctx2d.strokeStyle = 'rgba(255,200,100,0.18)';
  ctx2d.lineWidth = 8;
  ctx2d.strokeRect(4, 4, size - 8, size - 8);
  ctx2d.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx2d.lineWidth = 4;
  ctx2d.strokeRect(8, 8, size - 16, size - 16);

  // Black inset (caved) pips — stamped into the die
  const pips = PIP_POS[face] ?? [];
  const pipR = 22;
  pips.forEach(([px, py]) => {
    const x = size / 2 + px * 330;
    const y = size / 2 - py * 330;

    // Outer shadow ring — depth illusion
    const shadow = ctx2d.createRadialGradient(x + 3, y + 3, pipR * 0.4, x, y, pipR * 1.35);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx2d.beginPath();
    ctx2d.arc(x, y, pipR * 1.35, 0, Math.PI * 2);
    ctx2d.fillStyle = shadow;
    ctx2d.fill();

    // Deep black pit
    const pit = ctx2d.createRadialGradient(x - 5, y - 5, 1, x, y, pipR);
    pit.addColorStop(0, '#1a0500');
    pit.addColorStop(0.6, '#0a0200');
    pit.addColorStop(1, '#000000');
    ctx2d.beginPath();
    ctx2d.arc(x, y, pipR, 0, Math.PI * 2);
    ctx2d.fillStyle = pit;
    ctx2d.fill();

    // Top-left rim highlight — candle light catching the carved edge
    const highlight = ctx2d.createRadialGradient(x - pipR * 0.5, y - pipR * 0.5, 0, x, y, pipR);
    highlight.addColorStop(0, 'rgba(255,200,80,0.28)');
    highlight.addColorStop(0.5, 'rgba(255,160,40,0.10)');
    highlight.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2d.beginPath();
    ctx2d.arc(x, y, pipR, 0, Math.PI * 2);
    ctx2d.fillStyle = highlight;
    ctx2d.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  _dieFaceTexCache.set(face, tex);
  return tex;
}

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
    uRockColor:         { value: new THREE.Color('#1a0530') },
    uCrackingIntensity: { value: 0.60 },
    uMobile:            { value: _isMobile ? 1.0 : 0.0 },
  },
  vertexShader: LavaDiceShader.vertexShader,
  fragmentShader: `
    uniform float uTime;
    uniform float uPulseSpeed;
    uniform vec3  uRockColor;
    uniform float uCrackingIntensity;
    uniform float uMobile;
    varying vec3 vNormal;
    varying vec3 vModelPosition;

    vec3 rainbow(float h) {
      vec3 c = mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0);
      return clamp(abs(c - 3.0) - 1.0, 0.0, 1.0);
    }
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

      // Primary noise octave always runs; second octave skipped on mobile via uMobile
      float n1 = noise(faceUV * 14.0 + uTime * 0.1) * 0.5;
      float n2 = noise(faceUV * 28.0 - uTime * 0.05) * 0.25;
      float n  = n1 + n2 * (1.0 - uMobile);

      float pipMask      = getDicePipsMask(faceNum, faceUV + vec2(n * 0.04), 0.065);
      float ambientCracks = smoothstep(uCrackingIntensity, uCrackingIntensity - 0.04, noise(faceUV * 9.0 + n));
      float totalCrackMask = max(pipMask, ambientCracks * 0.3);

      // Spectral shift: noise drives hue flow so colours move organically through cracks
      float hueBase  = mod(uTime * 0.2 + length(vModelPosition) * 0.5 + n * 0.8, 1.0);
      float hueCrack = mod(hueBase + noise(faceUV * 5.0 + uTime * 0.05) * 0.3, 1.0);
      vec3 wildColor = mix(rainbow(hueBase), rainbow(hueCrack), totalCrackMask);

      float pulse    = sin(uTime * uPulseSpeed) * 0.06 + 1.0;
      float coreGlow = smoothstep(0.85, 0.15, length(vModelPosition)) * pulse;

      vec3 emissiveColor = mix(wildColor, vec3(1.0), coreGlow * 0.5);
      vec3 finalColor    = mix(uRockColor, emissiveColor, totalCrackMask);
      finalColor += wildColor * (1.0 - totalCrackMask) * 0.15 * coreGlow;
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
      matRef.current.uniforms['uCrackingIntensity']!.value = preDestroyGlow ? 0.15 : inChain ? 0.35 : 0.60;
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

// ── DieCube — rounded 6-face cube die ────────────────────────────────────────
// BoxGeometry material slot order: [+x(right), -x(left), +y(top), -y(bottom), +z(front), -z(back)]
function DieCube({ face, inChain }: { face: number; inChain: boolean }) {
  const { top, right } = FACE_SIDES[face] ?? { top: 2, right: 3 };
  const bottom = 7 - top;
  const back   = 7 - face;
  const left   = 7 - right;
  const slots  = [right, left, top, bottom, face, back];

  return (
    <group>
      <mesh castShadow geometry={_roundedDieGeom}>
        {slots.map((fv, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={getDieFaceTex(fv)}
            roughness={0.42}
            metalness={0.06}
            emissive={inChain ? (FACE_COLOR[fv] ?? '#ffffff') : '#000000'}
            emissiveIntensity={inChain ? 0.5 : 0}
          />
        ))}
      </mesh>
      {/* Glow rim shell */}
      {inChain && (
        <mesh scale={[1.08, 1.08, 1.08]} geometry={_roundedDieGeom}>
          <meshBasicMaterial
            color={FACE_COLOR[face] ?? '#7ecfff'}
            transparent
            opacity={0.20}
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

  // Box (die, wild, ice, lock, mirror, stone, bomb, rainbow_bomb, catalyst)
  const needsHealthPips =
    (body.entityType === 'lock' && body.health > 0) ||
    body.entityType === 'stone';
  const maxPips = body.entityType === 'stone' ? 3 : 3;

  // ── Die: full 6-face cube ──────────────────────────────────────────────────
  if (body.entityType === 'die' && body.face != null) {
    return (
      <group ref={groupRef} userData={entityUserData} {...chainHandlers}>
        <DieCube face={body.face} inChain={body.inChain} />
      </group>
    );
  }

  // ── All other box entities (wild, ice, lock, mirror, stone, catalyst) ──────
  // Shiny metallic feel for blockers; pick material properties per type
  const isShinyBlocker = body.entityType === 'stone' || body.entityType === 'ice' || body.entityType === 'lock';
  const blockerRoughness = body.entityType === 'ice' ? 0.04 : body.entityType === 'stone' ? 0.10 : 0.08;
  const blockerMetal     = body.entityType === 'ice' ? 0.55 : body.entityType === 'stone' ? 0.82 : 0.78;

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
      {/* Raised ambient — dice base visibility */}
      <ambientLight intensity={2.0} color="#8aaabb" />
      {/* KEY LIGHT — strong warm angled from upper-right-front; creates realistic face shading */}
      <directionalLight position={[6, 8, 7]} intensity={3.5} color="#fff8e0" />
      {/* FILL LIGHT — cooler upper-left, softens shadows without flattening */}
      <directionalLight position={[-4, 5, 3]} intensity={1.5} color="#c8dde8" />
      {/* Three candle lights — left, center, right — different phases so they flicker independently */}
      <CandleLight position={[-3.2, 1.5, 3.0]} phase={0.0} />
      <CandleLight position={[ 0.0, 2.5, 3.5]} phase={1.7} />
      <CandleLight position={[ 3.2, 1.5, 3.0]} phase={3.3} />
      {/* Warm backfill so rear face of dice keeps edge definition */}
      <pointLight position={[0, 5, -3]} intensity={1.5} color="#ff7a20" distance={14} decay={2} />
      <ColumnGrid />
      <DoublerCellPanels />
      <ChainLine />
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
    <Canvas
      style={{ width: '100%', height: '100%', background: '#0a1628', touchAction: 'none' }}
      camera={{ fov: 65, near: 0.1, far: 100 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      dpr={Math.min(window.devicePixelRatio, 2)}
      flat
    >
      <SceneContent
        onChainStart={onChainStart}
        onChainExtend={onChainExtend}
        onChainEnd={onChainEnd}
        onEntityTap={onEntityTap}
        {...(onEmptyTap !== undefined ? { onEmptyTap } : {})}
      />
    </Canvas>
  );
}
