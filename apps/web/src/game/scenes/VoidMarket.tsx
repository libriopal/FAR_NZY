// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// VoidMarket scene — INDUSTRIAL + CRYSTALLINE blend.
// Underground holographic trading floor.
// Prices from @match3d/blockchain or Supabase only — never local state.
// Sale animation fires ONLY after on-chain confirmation — never on pending.
// Prohibited: fake bid counters, artificial scarcity timers, fake viewer counts.
// ─────────────────────────────────────────────────────

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR, CURRENCY, OV, TYPE } from '../../theme/tokens.js';

// ── Market listing shape — sourced from blockchain/Supabase ──────────────────
export interface MarketListing {
  id:               string;
  itemName:         string;
  rarity:           'common' | 'rare' | 'epic' | 'legendary';
  priceSDX:         number;    // authoritative price from blockchain
  deterministicSeed: number;   // from token ID
  confirmed:        boolean;   // on-chain confirmation state
}

export interface SaleEvent {
  listingId: string;
  confirmed: boolean; // only animate after confirmed=true
}

export interface VoidMarketProps {
  listings?:     MarketListing[];
  activeSale?:   SaleEvent | null;
  traderCount?:  number; // from real session data only
}

// ── Halton low-discrepancy sequence — deterministic crowd positions ────────────
function halton(index: number, base: number): number {
  let f = 1, r = 0, i = index;
  while (i > 0) { f /= base; r += f * (i % base); i = Math.floor(i / base); }
  return r;
}

// ── Rarity color ──────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<string, string> = {
  common:    OV.bone,
  rare:      OV.cyan,
  epic:      PILLAR.CRYSTALLINE.accent,
  legendary: PILLAR.CRYSTALLINE.primary,
};

// ── NFT listing frame — instanced slab rows ───────────────────────────────────
const FRAME_GEO = new THREE.BoxGeometry(1.1, 1.5, 0.06);

function ListingFrames({ listings }: { listings: MarketListing[] }) {
  const count   = Math.min(listings.length, 20);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);
  const initRef = useRef(false);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: PILLAR.INDUSTRIAL.surface,
    metalness: 0.85,
    roughness: 0.25,
  }), []);

  useFrame(() => {
    if (!meshRef.current || initRef.current) return;
    const cols  = 5;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      dummy.position.set(-4.4 + col * 2.2, 0.2 - row * 2.0, -4 + row * 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    initRef.current = true;
  });

  if (count === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[FRAME_GEO, frameMat, count]} castShadow />
  );
}

// ── Holographic price display — emissive plane ────────────────────────────────
function PriceDisplay({
  position,
  listing,
}: {
  position: [number, number, number];
  listing:  MarketListing;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const rarityColor = RARITY_COLOR[listing.rarity] ?? OV.bone;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    const t = clock.getElapsedTime();
    matRef.current.emissiveIntensity = 0.35 + 0.15 * Math.sin(t * 1.1 + listing.deterministicSeed);
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[0.9, 0.4, 1, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color={PILLAR.INDUSTRIAL.surface}
        emissive={rarityColor}
        emissiveIntensity={0.35}
        transparent
        opacity={0.82}
      />
    </mesh>
  );
}

// ── Sale confirmation stream — fires ONLY when confirmed=true ─────────────────
// Particle stream flows from seller slot toward buyer (center floor).
const SALE_PARTICLE_COUNT = 80;

function SaleStream({ confirmed }: { confirmed: boolean }) {
  const initialPos = useMemo(() => {
    const pos = new Float32Array(SALE_PARTICLE_COUNT * 3);
    for (let i = 0; i < SALE_PARTICLE_COUNT; i++) {
      const t   = i / SALE_PARTICLE_COUNT;
      pos[i * 3]     = (t - 0.5) * 6;
      pos[i * 3 + 1] = Math.sin(t * Math.PI * 2) * 0.4;
      pos[i * 3 + 2] = 0;
    }
    return pos;
  }, []);

  const posRef  = useRef<Float32Array>(initialPos);
  const attrRef = useRef<THREE.BufferAttribute>(null);

  useFrame((_, dt) => {
    if (!confirmed) return;
    const pos = posRef.current;
    for (let i = 0; i < SALE_PARTICLE_COUNT; i++) {
      const xIdx  = i * 3;
      const xNext = (pos[xIdx] ?? 0) + dt * 2.5;
      pos[xIdx] = xNext > 3 ? -3 : xNext;
    }
    if (attrRef.current) {
      (attrRef.current.array as Float32Array).set(pos);
      attrRef.current.needsUpdate = true;
    }
  });

  if (!confirmed) return null;

  return (
    <points position={[0, 0.5, -2]}>
      <bufferGeometry>
        <bufferAttribute
          ref={attrRef}
          attach="attributes-position"
          args={[posRef.current, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={CURRENCY.sdx.glowColor}
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
      />
    </points>
  );
}

// ── Ambient trader crowd — deterministic, seeded from traderCount ─────────────
const TRADER_GEO = new THREE.CapsuleGeometry(0.07, 0.18, 4, 6);
const TRADER_MAT = new THREE.MeshStandardMaterial({
  color: PILLAR.INDUSTRIAL.secondary ?? '#8a8a8a',
  roughness: 0.9,
});

function TraderCrowd({ count }: { count: number }) {
  const clamped = Math.min(40, Math.max(0, count));
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const initRef = useRef(false);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  const phases = useMemo(() =>
    new Float32Array(Array.from({ length: clamped }, (_, i) => halton(i + 1, 7) * Math.PI * 2)),
    [clamped],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    if (!initRef.current) {
      for (let i = 0; i < clamped; i++) {
        const x = (halton(i + 1, 2) - 0.5) * 10;
        const z = (halton(i + 1, 3) - 0.5) * 7;
        dummy.position.set(x, -1.0, z);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      initRef.current = true;
    }

    const t = clock.getElapsedTime();
    for (let i = 0; i < clamped; i++) {
      const phase = phases[i] ?? 0;
      const r     = 0.8 + (i % 4) * 0.6;
      dummy.position.x = Math.cos(phase + t * 0.12) * r + (halton(i + 1, 2) - 0.5) * 7;
      dummy.position.y = -1.0;
      dummy.position.z = Math.sin(phase + t * 0.12) * r + (halton(i + 1, 3) - 0.5) * 5;
      dummy.rotation.y = phase + t * 0.12 + Math.PI / 2;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (clamped === 0) return null;

  return <instancedMesh ref={meshRef} args={[TRADER_GEO, TRADER_MAT, clamped]} castShadow />;
}

// ── Trading floor — concrete + amber accent lights ────────────────────────────
function TradingFloor() {
  return (
    <>
      {/* Floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[16, 12, 1, 1]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1.5, -6.5]} receiveShadow>
        <planeGeometry args={[16, 6, 1, 1]} />
        <meshStandardMaterial color="#222222" roughness={0.9} />
      </mesh>

      {/* Floor amber inlay strips */}
      {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
        <mesh key={i} position={[x, -1.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 12, 1, 1]} />
          <meshStandardMaterial
            color={PILLAR.INDUSTRIAL.primary}
            emissive={PILLAR.INDUSTRIAL.primary}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* UV ceiling glow — CRYSTALLINE contamination */}
      <mesh position={[0, 4.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 10, 1, 1]} />
        <meshStandardMaterial
          color={PILLAR.CRYSTALLINE.surface}
          emissive={PILLAR.CRYSTALLINE.primary}
          emissiveIntensity={0.12}
          transparent
          opacity={0.6}
        />
      </mesh>
    </>
  );
}

// ── Market lights ─────────────────────────────────────────────────────────────
function MarketLights() {
  const uvRef = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!uvRef.current) return;
    const t = clock.getElapsedTime();
    uvRef.current.intensity = 0.8 + 0.3 * Math.sin(t * 0.7);
  });

  return (
    <>
      {/* Row of amber overhead lights */}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <pointLight
          key={i}
          position={[x, 4, -2]}
          color={PILLAR.INDUSTRIAL.primary}
          intensity={1.0}
          distance={8}
          decay={2}
        />
      ))}
      {/* Pulsing UV from rear */}
      <pointLight
        ref={uvRef}
        position={[0, 2, -6]}
        color={PILLAR.CRYSTALLINE.primary}
        intensity={0.8}
        distance={10}
        decay={2}
      />
    </>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function VoidMarketScene({
  listings     = [],
  activeSale   = null,
  traderCount  = 20,
}: VoidMarketProps) {
  // Price displays positioned above first row of listing frames
  const priceDisplays = useMemo(() =>
    listings.slice(0, 5).map((l, i) => ({
      position: [-4.4 + i * 2.2, 1.15, -3.95] as [number, number, number],
      listing: l,
    })),
    [listings],
  );

  return (
    <Canvas
      shadows
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 2.5, 7], fov: 58, near: 0.1, far: 60 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.95,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: 'high-performance',
      }}
      style={{ background: PILLAR.INDUSTRIAL.surface }}
    >
      <fog attach="fog" args={[PILLAR.INDUSTRIAL.surface, 12, 40]} />
      <Environment preset="warehouse" />

      <ambientLight color="#0f0f0f" intensity={0.3} />
      <MarketLights />

      <TradingFloor />
      <ListingFrames listings={listings} />

      {priceDisplays.map(({ position, listing }) => (
        <PriceDisplay key={listing.id} position={position} listing={listing} />
      ))}

      <TraderCrowd count={traderCount} />

      {activeSale && <SaleStream confirmed={activeSale.confirmed} />}
    </Canvas>
  );
}
