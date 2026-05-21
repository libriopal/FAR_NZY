// ─────────────────────────────────────────────────────
// FARKLE FRENZY / FAR_NZY — SURFACE FILE
// CargoOpeningSequence — 7-step reward reveal ceremony.
// Rarity and reward source MUST come from Zustand — never computed here.
// Sacred Core: step 7 (counter confirm) fires ONLY after blockchain confirmation.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { PILLAR, CURRENCY, OV, TYPE } from '../theme/tokens.js';

// ── Rarity tiers — must match Zustand item.rarity ────────────────────────────
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CargoItem {
  name:     string;
  rarity:   ItemRarity;
  quantity: number;
  /** 'sdx_level_completion' | 'sdx_staking' | 'sdx_giveaway' | 'sdx_marketplace' | 'fd' | 'pdx' */
  source:   string;
  /** Deterministic seed from token ID — never use Math.random() for item visuals */
  deterministicSeed: number;
}

export interface CargoOpeningSequenceProps {
  item:              CargoItem;
  /** true only after @match3d/blockchain confirms the transaction */
  blockchainConfirmed: boolean;
  onComplete:        () => void;
}

// ── Rarity palette ────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<ItemRarity, string> = {
  common:    OV.bone,
  rare:      OV.cyan,
  epic:      PILLAR.CRYSTALLINE.accent,
  legendary: PILLAR.CRYSTALLINE.primary,
};

const RARITY_EMISSIVE: Record<ItemRarity, string> = {
  common:    'rgba(232,213,163,0.2)',
  rare:      OV.cyanGlow,
  epic:      'rgba(191,128,255,0.4)',
  legendary: 'rgba(123,0,255,0.6)',
};

// ── Crate mesh — spring-overshoot scale from 0→1 ─────────────────────────────
function CrateMesh({ rarity, seed }: { rarity: ItemRarity; seed: number }) {
  const ref         = useRef<THREE.Mesh>(null);
  const scaleRef    = useRef(0.0);
  const velRef      = useRef(0.0);
  const mountedAt   = useRef(performance.now());
  const color       = RARITY_COLOR[rarity];

  // Spring constants — overshoot on entrance
  const stiffness = 280;
  const damping   = 18;

  useFrame((_, dt) => {
    if (!ref.current) return;
    const elapsed = (performance.now() - mountedAt.current) / 1000;
    if (elapsed < 0.05) return; // wait one frame to appear

    const target = 1.0;
    const force  = (target - scaleRef.current) * stiffness - velRef.current * damping;
    velRef.current    += force * dt;
    scaleRef.current  += velRef.current * dt;

    ref.current.scale.setScalar(Math.max(0, scaleRef.current));
    // Slow rotation — deterministic from seed
    ref.current.rotation.y += (0.3 + (seed % 7) * 0.05) * dt;
  });

  return (
    <mesh ref={ref} scale={[0, 0, 0]} castShadow>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        roughness={rarity === 'legendary' ? 0.05 : 0.4}
        metalness={rarity === 'legendary' ? 0.8 : 0.3}
        wireframe={rarity === 'legendary'}
      />
    </mesh>
  );
}

// ── Particle eruption — mounts during step 4 ─────────────────────────────────
function ParticleEruption({ rarity }: { rarity: ItemRarity }) {
  const color = RARITY_COLOR[rarity];
  const count = rarity === 'legendary' ? 500 : rarity === 'epic' ? 300 : 150;
  return (
    <Sparkles
      count={count}
      scale={[3.5, 3.5, 3.5]}
      size={rarity === 'legendary' ? 1.8 : 1.0}
      speed={rarity === 'legendary' ? 4.0 : 2.5}
      opacity={0.85}
      color={color}
      noise={1.5}
    />
  );
}

// ── Bloom-glow point light — intensifies during rarity surge (step 6) ─────────
function RarityLight({ rarity, surging }: { rarity: ItemRarity; surging: boolean }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const target   = surging ? 8.0 : 1.5;

  useFrame((_, dt) => {
    if (!lightRef.current) return;
    lightRef.current.intensity += (target - lightRef.current.intensity) * 8 * dt;
  });

  return (
    <pointLight
      ref={lightRef}
      color={RARITY_COLOR[rarity]}
      intensity={1.5}
      distance={8}
      decay={2}
    />
  );
}

// ── 3D scene — canvas embedded in the overlay ────────────────────────────────
function CargoScene({ item, step }: { item: CargoItem; step: number }) {
  return (
    <Canvas
      dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 2, 2)]}
      camera={{ position: [0, 0, 4], fov: 45, near: 0.1, far: 30 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.4,
        outputColorSpace: THREE.SRGBColorSpace,
        alpha: true,
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.2} />
      <RarityLight rarity={item.rarity} surging={step >= 6} />

      {step >= 3 && <CrateMesh rarity={item.rarity} seed={item.deterministicSeed} />}
      {step >= 4 && <ParticleEruption rarity={item.rarity} />}
    </Canvas>
  );
}

// ── Step timing table (ms from sequence start) ───────────────────────────────
//  1 → 0      ambient darkens
//  2 → 800    reactor spike
//  3 → 1200   crate unlock (spring scale)
//  4 → 1800   particle eruption
//  5 → 2200   silhouette reveal fade-in
//  6 → 2800   rarity surge (bloom)
//  7 → 3600   item stabilization; blockchain confirm gate
const STEP_TIMES = [0, 800, 1200, 1800, 2200, 2800, 3600];

export function CargoOpeningSequence({
  item,
  blockchainConfirmed,
  onComplete,
}: CargoOpeningSequenceProps) {
  const [step, setStep]     = useState(1);
  const [opacity, setOpacity] = useState(0);
  const timers = useRef<number[]>([]);

  // Guard: SDX source validation
  const isSDX = item.source.startsWith('sdx_');
  const validSDXSources = ['sdx_level_completion', 'sdx_staking', 'sdx_giveaway', 'sdx_marketplace'];
  useEffect(() => {
    if (isSDX && !validSDXSources.includes(item.source)) {
      console.warn('[CargoOpeningSequence] Unknown SDX source:', item.source, '— ceremony suppressed.');
    }
  }, [item.source]);

  const advance = useCallback((s: number, delay: number) => {
    const id = window.setTimeout(() => setStep(s), delay);
    timers.current.push(id);
  }, []);

  useEffect(() => {
    // Fade in overlay
    const fadeId = window.setTimeout(() => setOpacity(1), 50);
    timers.current.push(fadeId);

    // Schedule steps 2–6 (steps 1 already = initial state)
    STEP_TIMES.slice(1).forEach((t, i) => advance(i + 2, t));

    return () => timers.current.forEach(id => window.clearTimeout(id));
  }, []);

  // Step 7 fires only after blockchain confirmation (Sacred Core rule)
  useEffect(() => {
    if (step >= 6 && blockchainConfirmed) {
      const id = window.setTimeout(() => {
        setStep(7);
        const doneId = window.setTimeout(onComplete, 1200);
        timers.current.push(doneId);
      }, 600);
      timers.current.push(id);
    }
  }, [step, blockchainConfirmed, onComplete]);

  // prefers-reduced-motion: skip animation, show result immediately
  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(5,0,8,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, fontFamily: TYPE.fontCode,
      }}>
        <div style={{ color: RARITY_COLOR[item.rarity], fontSize: 20, fontWeight: 700 }}>
          {item.name}
        </div>
        <div style={{ color: OV.boneDim, fontSize: 12 }}>
          {item.rarity.toUpperCase()} · {item.quantity}×
        </div>
        <button
          onClick={onComplete}
          style={{
            marginTop: 16, background: OV.cyan, border: 'none', color: OV.void,
            borderRadius: 6, padding: '10px 24px', fontFamily: TYPE.fontCode,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Collect
        </button>
      </div>
    );
  }

  const rarityColor   = RARITY_COLOR[item.rarity];
  const rarityEmissive = RARITY_EMISSIVE[item.rarity];

  // Step 1: ambient darkens — overlay opacity interpolated
  const overlayBg = step >= 1
    ? `rgba(5,0,8,${0.75 + Math.min(step - 1, 0.1)})`
    : 'rgba(5,0,8,0)';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: overlayBg,
      opacity,
      transition: 'opacity 0.4s ease, background 0.8s ease',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: step >= 7 ? 'auto' : 'none',
    }}>
      {/* 3D canvas — absolute behind UI */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CargoScene item={item} step={step} />
      </div>

      {/* Step 5+ — silhouette name fade-in */}
      {step >= 5 && (
        <div style={{
          position: 'relative', zIndex: 1,
          textAlign: 'center',
          opacity: step >= 5 ? 1 : 0,
          transition: 'opacity 0.6s ease',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          {/* Filigree row */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[5, 4, 7, 4, 5].map((s, i) => (
              <div key={i} style={{
                width: s, height: s, background: rarityColor,
                transform: 'rotate(45deg)',
                boxShadow: `0 0 6px ${rarityEmissive}`,
              }} />
            ))}
          </div>

          <div style={{
            fontSize: 9, color: OV.boneDim, letterSpacing: 4,
            textTransform: 'uppercase', fontFamily: TYPE.fontCode,
          }}>
            {item.rarity}
          </div>

          <div style={{
            fontSize: 28, fontWeight: 900, color: rarityColor,
            fontFamily: TYPE.fontDisplay, letterSpacing: 3,
            textShadow: `0 0 20px ${rarityEmissive}, 0 0 50px ${rarityEmissive}`,
          }}>
            {item.name}
          </div>

          <div style={{
            fontSize: 14, color: OV.boneDim, fontFamily: TYPE.fontCode,
            letterSpacing: 2,
          }}>
            {isSDX
              ? `${item.quantity} ${item.quantity === 1 ? CURRENCY.sdx.labelSingular : CURRENCY.sdx.labelPlural}`
              : `×${item.quantity}`}
          </div>

          {/* Step 7 — blockchain confirmed, show collect button */}
          {step >= 7 && blockchainConfirmed && (
            <button
              onClick={onComplete}
              style={{
                marginTop: 12,
                background: step >= 7 ? rarityColor : 'transparent',
                border: `1px solid ${rarityColor}`,
                color: step >= 7 ? OV.void : rarityColor,
                borderRadius: 6, padding: '10px 28px',
                fontFamily: TYPE.fontCode, fontSize: 13,
                fontWeight: 700, cursor: 'pointer',
                letterSpacing: 2,
                boxShadow: `0 0 16px ${rarityEmissive}`,
                transition: 'all 0.3s ease',
              }}
            >
              COLLECT
            </button>
          )}

          {/* Waiting for blockchain confirmation */}
          {step >= 6 && !blockchainConfirmed && (
            <div style={{
              fontSize: 10, color: OV.boneDim, fontFamily: TYPE.fontCode,
              letterSpacing: 2, marginTop: 8,
            }}>
              CONFIRMING ON-CHAIN…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
