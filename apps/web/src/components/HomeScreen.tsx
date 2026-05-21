// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore.js';
import { QuestPanel } from './QuestPanel.js';
import { EventBanner } from './EventBanner.js';
import { LEVELS } from '../data/levels.js';
import { OV, TYPE, CURRENCY } from '../theme/tokens.js';

const GH = {
  void:        OV.void,
  neural:      OV.neural,
  bone:        OV.bone,
  boneDim:     OV.boneDim,
  boneFaint:   'rgba(232,213,163,0.18)',
  gold:        OV.gold,
  goldBright:  OV.goldBright,
  goldGlow:    OV.goldGlow,
  goldDim:     OV.goldDim,
  acidLime:    OV.acidLime,
  limeDim:     OV.acidLimeGlow,
  cyan:        OV.cyan,
  cyanGlow:    OV.cyanGlow,
  cyanDim:     OV.cyanGlow,
  magenta:     OV.magenta,
  magentaDim:  'rgba(255,0,204,0.15)',
  panelBg:     'rgba(5,0,18,0.92)',
  panelBorder: OV.goldDim,
  cardBg:      'rgba(13,0,24,0.85)',
  cardBorder:  OV.cyanGlow,
} as const;

const CRT: React.CSSProperties = {
  position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
  background: `
    repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px),
    radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)
  `,
};

function GhCorner({ top, right, bottom, left }: { top?: number; right?: number; bottom?: number; left?: number }) {
  const hAnchor = left !== undefined ? 'left' : 'right';
  const vAnchor = top !== undefined ? 'top' : 'bottom';
  return (
    <div style={{ position: 'absolute', width: 12, height: 12, top, right, bottom, left }}>
      <div style={{ position: 'absolute', width: 10, height: 1.5, background: GH.gold, [vAnchor]: 0, [hAnchor]: 0 }} />
      <div style={{ position: 'absolute', width: 1.5, height: 10, background: GH.gold, [vAnchor]: 0, [hAnchor]: 0 }} />
      <div style={{ position: 'absolute', width: 2.5, height: 2.5, background: GH.gold, transform: 'rotate(45deg)', [vAnchor]: 4.5, [hAnchor]: 4.5 }} />
    </div>
  );
}

// ── Idle attract — ghostly dice falling in the void ────────────────────────────

function useIdleTimer(timeoutMs: number): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      setIsIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsIdle(true), timeoutMs);
    };

    reset();
    window.addEventListener('pointermove', reset, { passive: true });
    window.addEventListener('pointerdown', reset, { passive: true });
    window.addEventListener('keydown', reset, { passive: true });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [timeoutMs]);

  return isIdle;
}

// Ghostly phantom die — cyan virtual reality, semi-transparent, slowly falling
function GhostDie({ x, phase, speed }: { x: number; phase: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * speed + phase) % 1;
    ref.current.position.y = 4 - t * 9;
    ref.current.rotation.x = clock.elapsedTime * 0.4 * speed;
    ref.current.rotation.y = clock.elapsedTime * 0.6 * speed;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    // Fade at top and bottom edges of fall
    mat.opacity = t < 0.12 ? t / 0.12 * 0.14 : t > 0.88 ? (1 - t) / 0.12 * 0.14 : 0.14;
  });

  return (
    <mesh ref={ref} position={[x, 4, -1.5]}>
      <boxGeometry args={[0.55, 0.55, 0.55]} />
      <meshStandardMaterial
        color={OV.cyan}
        emissive={OV.cyan}
        emissiveIntensity={0.6}
        transparent
        opacity={0.14}
      />
    </mesh>
  );
}

// Phantom chain pulse — suggest gameplay interaction to idle user
function PhantomChainPulse() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const s = clock.elapsedTime * 0.7;
    groupRef.current.position.y = Math.sin(s) * 0.12 - 1.6;
    groupRef.current.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m) m.opacity = 0.18 + Math.sin(s + i * 1.2) * 0.08;
    });
  });

  const positions: [number, number, number][] = [[-0.7, 0, 0], [0, 0, 0], [0.7, 0, 0]];
  return (
    <group ref={groupRef} position={[0, -1.6, -0.5]}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial
            color={OV.gold}
            emissive={OV.gold}
            emissiveIntensity={0.5}
            transparent
            opacity={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

function IdleAttractScene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <GhostDie x={-1.8} phase={0.0} speed={0.28} />
      <GhostDie x={-0.9} phase={0.33} speed={0.22} />
      <GhostDie x={0.1}  phase={0.67} speed={0.31} />
      <GhostDie x={1.0}  phase={0.15} speed={0.25} />
      <GhostDie x={1.9}  phase={0.52} speed={0.19} />
      <GhostDie x={-0.4} phase={0.80} speed={0.26} />
      <PhantomChainPulse />
      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.15} intensity={1.8} />
      </EffectComposer>
    </>
  );
}

function IdleAttractCanvas() {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
    }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ fov: 55, position: [0, 0, 5] }}
        gl={{ antialias: false, alpha: true, powerPreference: 'default' }}
      >
        <IdleAttractScene />
      </Canvas>
      {/* 2D phantom chain suggestion — no font loading required */}
      <div style={{
        position: 'absolute', bottom: '18%', left: 0, right: 0,
        textAlign: 'center', pointerEvents: 'none',
        animation: 'idlePulse 2.4s ease-in-out infinite',
      }}>
        <span style={{
          color: OV.gold, fontSize: 10, letterSpacing: 4,
          fontFamily: TYPE.fontCode, opacity: 0.35,
          textShadow: `0 0 10px ${OV.goldGlow}`,
          textTransform: 'uppercase',
        }}>
          ▸ ▸ ▸ &nbsp; TAP TO CHAIN &nbsp; ◂ ◂ ◂
        </span>
      </div>
      <style>{`
        @keyframes idlePulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const setActiveScreen    = useGameStore(s => s.setActiveScreen);
  const setGameMode        = useGameStore(s => s.setGameMode);
  const resources          = useGameStore(s => s.resources);
  const selectedLevelId    = useGameStore(s => s.selectedLevelId);
  const setSelectedLevelId = useGameStore(s => s.setSelectedLevelId);
  const [showLevels, setShowLevels] = useState(false);
  const isIdle = useIdleTimer(10_000);

  const selectedLevel = LEVELS.find(l => l.id === selectedLevelId) ?? LEVELS[0]!;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: GH.void,
      color: GH.bone, fontFamily: TYPE.fontCode, padding: '20px 20px 32px',
      position: 'relative', overflowX: 'hidden',
    }}>
      {isIdle && <IdleAttractCanvas />}
      <div style={CRT} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', marginTop: 36, marginBottom: 24,
        position: 'relative', zIndex: 1,
      }}>
        {/* Filigree rule above title */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ height: 1, width: 40, background: `linear-gradient(90deg, transparent, ${GH.goldDim})` }} />
          <div style={{ width: 5, height: 5, background: GH.gold, transform: 'rotate(45deg)', boxShadow: `0 0 6px ${GH.goldGlow}` }} />
          <div style={{ height: 1, width: 40, background: `linear-gradient(90deg, ${GH.goldDim}, transparent)` }} />
        </div>

        <h1 style={{
          fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: 4,
          background: `linear-gradient(90deg, ${GH.gold}, ${GH.acidLime}, ${GH.cyan})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textShadow: 'none',
          fontFamily: TYPE.fontDisplay,
          filter: 'drop-shadow(0 0 12px rgba(200,212,0,0.4))',
        }}>
          FARKLE FRENZY
        </h1>
        <p style={{
          color: GH.boneDim, fontSize: 10, margin: '4px 0 0',
          letterSpacing: 3, textTransform: 'uppercase',
          fontFamily: TYPE.fontCode,
        }}>
          Gothic Hacker Casino · Organic Vegas
        </p>
      </div>

      {/* ── Resource Summary ────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 20, marginBottom: 20,
        background: GH.cardBg, borderRadius: 10,
        border: `1px solid ${GH.panelBorder}`,
        padding: '10px 18px', position: 'relative', zIndex: 1,
      }}>
        <GhCorner top={0} left={0} />
        <GhCorner top={0} right={0} />
        <GhCorner bottom={0} left={0} />
        <GhCorner bottom={0} right={0} />
        <ResourceBadge label="Steel"             value={resources.bioSteel}    color={GH.cyan}    />
        <ResourceBadge label="Seeds"             value={resources.aeroSeeds}   color={GH.acidLime}/>
        <ResourceBadge label={CURRENCY.fd.symbol}  value={resources.goldCoins}   color={GH.gold}    />
        <ResourceBadge label={CURRENCY.pdx.symbol} value={resources.sweepsCoins} color={GH.magenta} />
      </div>

      {/* ── Live Events ─────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 6, position: 'relative', zIndex: 1 }}>
        <EventBanner />
      </div>

      {/* ── Quests ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 360 }}>
        <QuestPanel />
      </div>

      {/* ── Main Actions ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        width: '100%', maxWidth: 360, marginTop: 10, position: 'relative', zIndex: 1,
      }}>
        {/* Play row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setGameMode('SOLO_FREE'); setActiveScreen('game'); }}
            style={{
              flex: 1, background: GH.acidLime,
              border: `1px solid rgba(200,212,0,0.6)`,
              color: GH.void, borderRadius: 10, padding: '15px 20px',
              fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: TYPE.fontCode,
              boxShadow: `0 4px 20px ${GH.limeDim}`,
              letterSpacing: 2, transition: 'opacity 0.15s ease',
            }}
          >
            ▶ PLAY
          </button>
          <button
            onClick={() => setShowLevels(v => !v)}
            style={{
              background: GH.cardBg, border: `1px solid ${GH.cardBorder}`,
              color: GH.cyan, borderRadius: 10, padding: '15px 14px',
              fontSize: 11, cursor: 'pointer', fontFamily: TYPE.fontCode, fontWeight: 700,
              letterSpacing: 1, minWidth: 68, textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 9, color: GH.boneDim, marginBottom: 2 }}>LEVEL</div>
            <div>{selectedLevel.name.split(' ').slice(-1)[0]} ▾</div>
          </button>
        </div>

        {/* Level picker */}
        {showLevels && (
          <div style={{
            background: GH.cardBg, border: `1px solid ${GH.panelBorder}`,
            borderRadius: 10, padding: 10,
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
          }}>
            {LEVELS.map((lvl, i) => {
              const active = lvl.id === selectedLevelId;
              return (
                <button
                  key={lvl.id}
                  onClick={() => { setSelectedLevelId(lvl.id); setShowLevels(false); }}
                  style={{
                    background: active ? GH.gold : 'rgba(201,168,76,0.06)',
                    border: `1px solid ${active ? GH.gold : GH.goldDim}`,
                    color: active ? GH.void : GH.bone,
                    borderRadius: 8, padding: '8px 4px',
                    fontSize: 11, cursor: 'pointer', fontFamily: TYPE.fontCode,
                    textAlign: 'center', fontWeight: active ? 900 : 400,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ fontSize: 9, color: active ? GH.void : GH.boneDim, marginTop: 2 }}>
                    {(lvl.winScore / 1000).toFixed(0)}k
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <NavButton label="⚔  MULTIPLAYER" accent={GH.cyan}    onClick={() => setActiveScreen('multiplayer')} />
        <NavButton label="🏛  ESTATE"      accent={GH.gold}    onClick={() => setActiveScreen('meta')} />
        <NavButton label="🛒  SHOP"        accent={GH.magenta} onClick={() => setActiveScreen('shop')} />
        <NavButton label="👥  SOCIAL"      accent={GH.bone}    onClick={() => setActiveScreen('social')} />
      </div>

      {/* ── Sweepstakes Disclaimer ──────────────────────────────────────────── */}
      <p style={{
        color: 'rgba(232,213,163,0.22)', fontSize: 10,
        marginTop: 28, textAlign: 'center', maxWidth: 320,
        lineHeight: 1.5, position: 'relative', zIndex: 1,
        fontFamily: TYPE.fontCode,
      }}>
        NO PURCHASE NECESSARY. Sweeps Coins have no cash value. Void where prohibited.
        18+ US residents only (except WA).
      </p>
    </div>
  );
}

function ResourceBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 44 }}>
      <div style={{ color, fontSize: 14, fontWeight: 700, textShadow: `0 0 8px ${color}`, fontFamily: TYPE.fontCode }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, marginTop: 1, fontFamily: TYPE.fontCode }}>
        {label}
      </div>
    </div>
  );
}

function NavButton({ label, accent, onClick }: { label: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: GH.cardBg, border: `1px solid ${GH.cardBorder}`,
        color: GH.bone, borderRadius: 10, padding: '14px 20px',
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: TYPE.fontCode, textAlign: 'left', letterSpacing: 1,
        borderLeft: `3px solid ${accent}`,
        transition: 'opacity 0.1s ease',
      }}
    >
      {label}
    </button>
  );
}
