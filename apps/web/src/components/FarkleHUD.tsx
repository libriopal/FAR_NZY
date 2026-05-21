// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getAnalyserNode, setMusicState } from '../audio/gameAudio.js';
import type { EmotionalState } from '../audio/gameAudio.js';
import { useFarkleStore, MULTIPLIER_LADDER, MAX_ENERGY, FRENZY_THRESHOLD, FRENZY_INSTABILITY_THRESHOLD } from '../store/farkleStore.js';
import { WIN_SCORE } from '../hooks/useFarkleGame.js';
import { useGameStore } from '../store/gameStore.js';
import { LEVELS } from '../data/levels.js';
import { getLevelTheme } from '../data/levelThemes.js';
import type { DisruptionType, GameMode } from '@match3d/farkle-shared';
import { HEIST_CONSTANTS } from '@match3d/farkle-shared';
import { FACET_MAP, SHARD_MAP, BEAT_MARKERS, PERFECT_ZONE } from '@match3d/farkle-engine';
import type { FacetId, ShardId } from '@match3d/farkle-engine';

// ── Palette helpers ───────────────────────────────────────────────────────────

const GH = {
  void:          '#050008',
  neural:        '#0d0018',
  bone:          '#e8d5a3',
  boneDim:       'rgba(232,213,163,0.35)',
  boneFaint:     'rgba(232,213,163,0.12)',
  gold:          '#c9a84c',
  goldBright:    '#f0c860',
  goldGlow:      'rgba(201,168,76,0.55)',
  goldDim:       'rgba(201,168,76,0.22)',
  cyan:          '#00e5ff',
  cyanBright:    '#80f9ff',
  cyanGlow:      'rgba(0,229,255,0.45)',
  cyanDim:       'rgba(0,229,255,0.15)',
  magenta:       '#ff00cc',
  magentaGlow:   'rgba(255,0,204,0.45)',
  magentaDim:    'rgba(255,0,204,0.15)',
  amberHot:      '#ff7200',
  amberGlow:     'rgba(255,114,0,0.55)',
  purpleMid:     '#7b2fff',
  purpleGlow:    'rgba(123,47,255,0.45)',
  purpleDim:     'rgba(123,47,255,0.15)',
  crystalFace:   'rgba(0,229,255,0.08)',
  crystalBorder: 'rgba(0,229,255,0.38)',
  panelBg:       'rgba(5,0,18,0.9)',
  panelBorder:   'rgba(201,168,76,0.42)',
  danger:        '#ef4444',
  dangerGlow:    'rgba(239,68,68,0.45)',
} as const;

// OV1 neon pip palette — matches VoxelPileScene exactly
const FACE_COLOR: Record<number, string> = {
  1: '#ff2244', 2: '#ff7700', 3: '#ffe000',
  4: '#00ff66', 5: '#00aaff', 6: '#cc44ff',
};

// Global keyframes injected once at module level
const _GLOBAL_STYLES = `
  @keyframes gh-frenzy-flicker {
    0%, 100% { opacity: 1; }
    8%        { opacity: 0.82; }
    16%       { opacity: 1; }
    32%       { opacity: 0.91; }
    48%       { opacity: 1; }
    64%       { opacity: 0.78; }
    80%       { opacity: 1; }
  }
  @keyframes void-resonant-pulse {
    0%, 100% { opacity: 1;    filter: drop-shadow(0 0 6px #00e5ff); }
    50%       { opacity: 0.65; filter: drop-shadow(0 0 14px #c9a84c); }
  }
  @keyframes void-ring-expand {
    0%   { transform: translate(-50%, -50%) scale(0); opacity: 0.9; }
    100% { transform: translate(-50%, -50%) scale(1);  opacity: 0; }
  }
  @keyframes void-spark-rise {
    0%   { transform: translateY(0)   scale(1);   opacity: 1; }
    100% { transform: translateY(-80px) scale(0.3); opacity: 0; }
  }
  @keyframes void-veil-in  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes void-veil-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes beat-perfect { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.6); } }
  @keyframes beat-good    { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes draft-slide-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shard-pulse { 0%,100% { box-shadow:0 0 8px rgba(255,114,0,0.6); } 50% { box-shadow:0 0 18px rgba(255,114,0,0.9); } }
`;

// CRT scanline + vignette overlay (reusable)
const CRT_STYLE: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: `
    repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px),
    radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)
  `,
  zIndex: 0,
};

// Gothic corner marks — cathedral arch-keystone style with serif tips and center pip
function GhCorners({ color = GH.gold }: { color?: string }) {
  const s = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 12, height: 12, zIndex: 3, ...pos,
  });
  const pip: React.CSSProperties = {
    position: 'absolute', width: 2.5, height: 2.5,
    background: color, transform: 'rotate(45deg)',
  };
  const h: React.CSSProperties = { position: 'absolute', background: color };
  const v: React.CSSProperties = { position: 'absolute', background: color };

  function corner(
    t?: number, r?: number, b?: number, l?: number,
    hAnchor: 'left' | 'right' = 'left',
    vAnchor: 'top' | 'bottom' = 'top',
  ) {
    const hStyle: React.CSSProperties = { ...h, width: 10, height: 1.5, [vAnchor]: 0, [hAnchor]: 0 };
    const vStyle: React.CSSProperties = { ...v, width: 1.5, height: 10, [vAnchor]: 0, [hAnchor]: 0 };
    const pipStyle: React.CSSProperties = { ...pip, [vAnchor]: 4.5, [hAnchor]: 4.5 };
    return (
      <div style={s({ top: t, right: r, bottom: b, left: l })}>
        <div style={hStyle} />
        <div style={vStyle} />
        <div style={pipStyle} />
      </div>
    );
  }

  return (
    <>
      {corner(2, undefined, undefined, 2, 'left',  'top')}
      {corner(2, 2, undefined, undefined, 'right', 'top')}
      {corner(undefined, undefined, 2, 2, 'left',  'bottom')}
      {corner(undefined, 2, 2, undefined, 'right', 'bottom')}
    </>
  );
}

// Filigree diamond row — cathedral tracery pattern with alternating sizes and center cross-gem
function FiligreeRow({ count = 5, color = GH.goldDim }: { count?: number; color?: string }) {
  const mid = Math.floor(count / 2);
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const isCenter = i === mid;
        const isLarge  = i % 2 === 0;
        if (isCenter) {
          // Cross-gem at center: rotated diamond with hair-line crosshairs
          return (
            <div key={i} style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: color, transform: 'rotate(45deg)',
                boxShadow: `0 0 5px ${color}, 0 0 10px ${color}`,
              }} />
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: GH.void, transform: 'translateY(-50%)', opacity: 0.7 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: GH.void, transform: 'translateX(-50%)', opacity: 0.7 }} />
            </div>
          );
        }
        const size = isLarge ? 5 : 3;
        return (
          <div key={i} style={{
            width: size, height: size, background: color,
            transform: 'rotate(45deg)', flexShrink: 0,
            boxShadow: isLarge ? `0 0 3px ${color}` : 'none',
            opacity: isLarge ? 1 : 0.6,
          }} />
        );
      })}
    </div>
  );
}

// ── Score Popup ───────────────────────────────────────────────────────────────

interface Popup { id: number; text: string; color: string; }

function ScorePopupLayer() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    return useFarkleStore.subscribe(
      s => s.banked,
      (next, prev) => {
        const delta = next - prev;
        if (delta > 0) {
          const id = ++counterRef.current;
          setPopups(p => [...p, { id, text: `+${delta.toLocaleString()}`, color: GH.goldBright }]);
          setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1200);
        }
      }
    );
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {popups.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          top: '38%', left: '50%',
          transform: 'translateX(-50%)',
          color: p.color,
          fontSize: 22, fontWeight: 700, fontFamily: 'monospace',
          textShadow: `0 0 12px ${p.color}, 0 0 24px ${GH.goldDim}`,
          animation: 'floatUp 1.2s ease-out forwards',
          whiteSpace: 'nowrap', letterSpacing: 2,
        }}>
          {p.text}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-70px); }
        }
      `}</style>
    </div>
  );
}

// ── Farkle Flash ──────────────────────────────────────────────────────────────

function FarkleFlash() {
  const [visible, setVisible] = useState(false);
  const farkleCount = useFarkleStore(s => s.farkleCount);
  const prevCount = useRef(0);

  useEffect(() => {
    if (farkleCount > prevCount.current) {
      prevCount.current = farkleCount;
      setVisible(true);
      setTimeout(() => setVisible(false), 700);
    }
  }, [farkleCount]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'rgba(239,68,68,0.18)',
      animation: 'farkleFlash 0.7s ease-out forwards',
    }}>
      <div style={{
        position: 'absolute', top: '42%', left: '50%', transform: 'translateX(-50%)',
        color: GH.danger, fontSize: 36, fontWeight: 900, fontFamily: 'monospace',
        textShadow: `0 0 20px ${GH.dangerGlow}, 0 0 40px ${GH.dangerGlow}`,
        letterSpacing: 8,
      }}>
        ✦ FARKLE ✦
      </div>
      <style>{`
        @keyframes farkleFlash { 0% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Mode Pulse ────────────────────────────────────────────────────────────────

function ModePulse() {
  const [pulse, setPulse] = useState<{ color: string; label: string } | null>(null);
  const mode = useFarkleStore(s => s.mode);
  const prevMode = useRef(mode);

  useEffect(() => {
    if (mode !== prevMode.current) {
      prevMode.current = mode;
      if (mode === 'FRENZY') setPulse({ color: GH.cyan, label: '⚡ FRENZY ⚡' });
      else if (mode === 'PRIME') setPulse({ color: GH.magenta, label: '◈ PRIME ◈' });
      else setPulse({ color: GH.boneDim, label: 'NORMAL' });
      setTimeout(() => setPulse(null), 900);
    }
  }, [mode]);

  if (!pulse) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        color: pulse.color, fontSize: 30, fontWeight: 900,
        fontFamily: 'monospace',
        textShadow: `0 0 24px ${pulse.color}, 0 0 48px ${pulse.color}`,
        animation: 'modePulse 0.9s ease-out forwards',
        letterSpacing: 8,
      }}>
        {pulse.label}
      </div>
      <style>{`
        @keyframes modePulse {
          0%   { opacity: 0; transform: scale(0.6) translateY(10px); }
          35%  { opacity: 1; transform: scale(1.12) translateY(0); }
          100% { opacity: 0; transform: scale(1.3) translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

// ── Trick Meter (Crystal Frenzy Gauge) ───────────────────────────────────────

function TrickMeter() {
  const { energy, mode } = useFarkleStore(s => ({ energy: s.energy, mode: s.mode }));
  const pct = (energy / MAX_ENERGY) * 100;
  const primePct = (FRENZY_THRESHOLD / MAX_ENERGY) * 100;
  const isResonant = energy >= MAX_ENERGY;

  const barColor = isResonant
    ? `linear-gradient(90deg, ${GH.cyan}, ${GH.gold}, ${GH.cyanBright})`
    : mode === 'FRENZY' ? `linear-gradient(90deg, ${GH.cyan}, ${GH.cyanBright}, ${GH.magenta})`
    : mode === 'PRIME'  ? `linear-gradient(90deg, ${GH.magenta}, ${GH.purpleMid})`
    : `linear-gradient(90deg, rgba(201,168,76,0.4), rgba(201,168,76,0.7))`;

  const glowColor = isResonant ? 'rgba(0,229,255,0.8)'
    : mode === 'FRENZY' ? GH.cyanGlow
    : mode === 'PRIME'  ? GH.magentaGlow
    : GH.goldDim;

  const modeLabel = isResonant  ? '✦ RESONANT ✦'
    : mode === 'FRENZY' ? '⚡FRENZY'
    : mode === 'PRIME'  ? '◈ PRIME'
    : '— NORMAL';

  const labelColor = isResonant  ? GH.gold
    : mode === 'FRENZY' ? GH.cyan
    : mode === 'PRIME'  ? GH.magenta
    : GH.boneDim;

  // 4 crystal nodes at 25%, 50%(prime), 75%, 100%
  const nodes = [25, primePct, 75, 100];

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 48,
      background: GH.panelBg,
      borderBottom: `1px solid ${GH.panelBorder}`,
      display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8,
      zIndex: 10,
    }}>
      <div style={CRT_STYLE} />
      <GhCorners />

      {/* Mode label */}
      <div style={{
        color: labelColor, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
        minWidth: 62, letterSpacing: 1,
        textShadow: `0 0 8px ${labelColor}`,
        animation: isResonant
          ? 'void-resonant-pulse 1.2s ease-in-out infinite'
          : mode === 'FRENZY' ? 'gh-frenzy-flicker 3.5s ease-in-out infinite' : 'none',
      }}>
        {modeLabel}
      </div>

      {/* Crystal gauge track */}
      <div style={{ flex: 1, position: 'relative', height: 12 }}>
        {/* Track bg — neural groove */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(5,0,18,0.8)',
          border: `1px solid ${GH.goldDim}`,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          {/* Fill */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: `${pct}%`,
            background: barColor,
            borderRadius: 2,
            transition: 'width 0.12s linear',
            boxShadow: mode !== 'NORMAL' ? `0 0 10px ${glowColor}` : 'none',
          }} />
        </div>

        {/* Crystal node markers */}
        {nodes.map((p, i) => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: `${p}%`,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            width: 7, height: 7,
            background: pct >= p ? (mode === 'FRENZY' ? GH.cyanBright : mode === 'PRIME' ? GH.magenta : GH.gold) : GH.boneFaint,
            border: `1px solid ${pct >= p ? GH.gold : GH.boneFaint}`,
            boxShadow: pct >= p ? `0 0 6px ${glowColor}` : 'none',
            transition: 'all 0.2s ease',
            zIndex: 2,
          }} />
        ))}

        {/* Prime threshold line */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${primePct}%`,
          width: 1,
          background: mode === 'PRIME' || mode === 'FRENZY' ? GH.magenta : 'rgba(255,0,204,0.25)',
          boxShadow: mode !== 'NORMAL' ? `0 0 4px ${GH.magentaGlow}` : 'none',
          zIndex: 1,
        }} />

        {/* VOID RESONANCE sigil — 6-pointed lattice ring at the MAX node */}
        {isResonant && (
          <svg viewBox="0 0 32 32" width={20} height={20} style={{
            position: 'absolute', top: '50%', right: -4,
            transform: 'translateY(-50%)',
            animation: 'void-resonant-pulse 1.2s ease-in-out infinite',
            zIndex: 5, overflow: 'visible',
          }}>
            {/* Outer ring */}
            <circle cx="16" cy="16" r="14" fill="none" stroke={GH.cyan} strokeWidth="1.2" opacity="0.9" />
            {/* 6 spokes — gothic lattice */}
            {[0,60,120,180,240,300].map(deg => {
              const rad = (deg * Math.PI) / 180;
              return <line key={deg}
                x1={16 + 5 * Math.cos(rad)} y1={16 + 5 * Math.sin(rad)}
                x2={16 + 14 * Math.cos(rad)} y2={16 + 14 * Math.sin(rad)}
                stroke={deg % 120 === 0 ? GH.gold : GH.cyan} strokeWidth="1" opacity="0.85"
              />;
            })}
            {/* Inner void circle */}
            <circle cx="16" cy="16" r="4" fill="none" stroke={GH.gold} strokeWidth="1.2" opacity="0.8" />
            <circle cx="16" cy="16" r="1.5" fill={GH.gold} opacity="0.9" />
          </svg>
        )}
      </div>

      {/* Energy readout */}
      <div style={{
        color: GH.boneDim, fontSize: 9, fontFamily: 'monospace',
        minWidth: 38, textAlign: 'right',
        letterSpacing: 0.5,
      }}>
        {Math.floor(energy)}<span style={{ color: GH.goldDim }}>/{MAX_ENERGY}</span>
      </div>
    </div>
  );
}

// ── NeonOscilloscope ──────────────────────────────────────────────────────────

function NeonOscilloscope() {
  const { mode } = useFarkleStore(s => ({ mode: s.mode }));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const waveColor  = mode === 'FRENZY' ? GH.cyan    : mode === 'PRIME' ? GH.magenta : GH.gold;
  const glowColor  = mode === 'FRENZY' ? GH.cyanGlow : mode === 'PRIME' ? GH.magentaGlow : GH.goldDim;
  const lineWidth  = mode === 'FRENZY' ? 2 : 1.5;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      const mid = H / 2;

      ctx2d.clearRect(0, 0, W, H);

      const analyser = getAnalyserNode();
      if (!analyser) {
        // Flat line fallback until audio starts
        ctx2d.beginPath();
        ctx2d.moveTo(0, mid);
        ctx2d.lineTo(W, mid);
        ctx2d.strokeStyle = waveColor;
        ctx2d.lineWidth = 1;
        ctx2d.stroke();
        return;
      }

      const bufLen = analyser.frequencyBinCount; // fftSize/2
      const data   = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(data);

      ctx2d.beginPath();
      const sliceW = W / bufLen;
      for (let i = 0; i < bufLen; i++) {
        const v = (data[i]! / 128.0) - 1;   // -1 … +1
        const y = mid + v * mid * 0.9;
        if (i === 0) ctx2d.moveTo(0, y);
        else ctx2d.lineTo(i * sliceW, y);
      }
      ctx2d.strokeStyle = waveColor;
      ctx2d.lineWidth   = lineWidth;
      ctx2d.shadowColor = glowColor;
      ctx2d.shadowBlur  = 5;
      ctx2d.stroke();
      ctx2d.shadowBlur  = 0;
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [waveColor, glowColor, lineWidth]);

  return (
    <div style={{
      position: 'absolute', top: 48, left: 0, right: 0, height: 28,
      background: 'rgba(5,0,18,0.7)',
      borderBottom: `1px solid ${GH.goldDim}`,
      overflow: 'hidden', zIndex: 9,
    }}>
      <div style={{
        position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
        fontSize: 7, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1, zIndex: 1,
      }}>OSC</div>
      <canvas
        ref={canvasRef}
        width={800}
        height={28}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

// ── Score Display (Gothic Panel) ──────────────────────────────────────────────

function ScoreDisplay() {
  const { banked, unbanked, multiplierStep, mode } = useFarkleStore(s => ({
    banked: s.banked, unbanked: s.unbanked, multiplierStep: s.multiplierStep, mode: s.mode,
  }));
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const levelWinScore = LEVELS.find(l => l.id === selectedLevelId)?.winScore ?? WIN_SCORE;
  const theme = getLevelTheme(selectedLevelId ?? 'level_01');
  const total = banked + unbanked;
  const mult = MULTIPLIER_LADDER[Math.min(multiplierStep, 5)] ?? 1;
  const progressPct = Math.min(100, (total / levelWinScore) * 100);
  const hasMult = mult > 1;

  // Milestone flash — fires once per threshold crossing per session
  const crossedRef = useRef<Set<number>>(new Set());
  const [flashActive, setFlashActive] = useState(false);
  const [flashColor, setFlashColor] = useState<string>(GH.gold);
  useEffect(() => {
    for (const frac of theme.milestones) {
      const threshold = Math.round(levelWinScore * frac);
      if (total >= threshold && !crossedRef.current.has(threshold)) {
        crossedRef.current.add(threshold);
        setFlashColor(frac < 0.5 ? GH.cyan : frac < 0.75 ? GH.gold : GH.magenta);
        setFlashActive(true);
        const t = setTimeout(() => setFlashActive(false), 320);
        return () => clearTimeout(t);
      }
    }
    return undefined;
  }, [total, levelWinScore, theme.milestones]);

  return (
    <div style={{
      position: 'absolute', top: 82, left: '50%', transform: 'translateX(-50%)',
      textAlign: 'center', pointerEvents: 'none',
    }}>
      {/* Gothic score panel — milestone flash expands border glow */}
      <div style={{
        background: GH.panelBg,
        border: `1px solid ${flashActive ? flashColor : GH.panelBorder}`,
        borderRadius: 4, padding: '5px 16px',
        position: 'relative', minWidth: 120,
        boxShadow: flashActive ? `0 0 22px ${flashColor}88, 0 0 44px ${flashColor}44` : undefined,
        transition: 'box-shadow 0.32s ease-out, border-color 0.32s ease-out',
      }}>
        <div style={CRT_STYLE} />
        <GhCorners />
        <FiligreeRow count={5} color={GH.goldDim} />
        {/* Mode-reactive separator rule */}
        <div style={{
          height: 1, margin: '3px 0 2px',
          background: mode === 'FRENZY'
            ? `linear-gradient(90deg, transparent, ${GH.cyan}, transparent)`
            : mode === 'PRIME'
              ? `linear-gradient(90deg, transparent, ${GH.magenta}, transparent)`
              : `linear-gradient(90deg, transparent, ${GH.gold}, transparent)`,
          boxShadow: mode === 'FRENZY' ? `0 0 6px ${GH.cyanGlow}`
            : mode === 'PRIME' ? `0 0 6px ${GH.magentaGlow}` : `0 0 4px ${GH.goldDim}`,
          opacity: 0.7,
        }} />
        <div style={{
          color: GH.goldBright, fontSize: 24, fontWeight: 900, fontFamily: 'monospace',
          textShadow: `0 0 10px ${GH.goldGlow}, 0 0 20px ${GH.goldDim}`,
          letterSpacing: 1, lineHeight: 1.1, marginTop: 2,
        }}>
          {total.toLocaleString()}
        </div>
        {hasMult && (
          <div style={{
            color: GH.cyan, fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            textShadow: `0 0 8px ${GH.cyanGlow}`, letterSpacing: 1,
          }}>
            ×{mult} MULTIPLIER
          </div>
        )}
        {/* Progress bar toward win */}
        <div style={{ width: 100, height: 3, background: 'rgba(201,168,76,0.12)', borderRadius: 2, margin: '4px auto 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${GH.gold}, ${GH.goldBright})`,
            boxShadow: `0 0 6px ${GH.goldGlow}`,
            transition: 'width 0.3s ease', borderRadius: 2,
          }} />
        </div>
        <div style={{ color: GH.goldDim, fontSize: 8, fontFamily: 'monospace', marginTop: 1 }}>
          {total.toLocaleString()}/{levelWinScore.toLocaleString()}
        </div>
        <FiligreeRow count={3} color={GH.goldDim} />
      </div>
    </div>
  );
}

// ── Shard Tracker (Build-a-Die) ───────────────────────────────────────────────

const SHARD_MAX = 6;

function ShardTracker() {
  const chainLen = useFarkleStore(s => s.chain.length);
  const mode = useFarkleStore(s => s.mode);

  const activeColor = mode === 'FRENZY' ? GH.cyan : mode === 'PRIME' ? GH.magenta : GH.gold;
  const activeGlow  = mode === 'FRENZY' ? GH.cyanGlow : mode === 'PRIME' ? GH.magentaGlow : GH.goldGlow;

  return (
    <div style={{
      position: 'absolute', top: 82, right: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      pointerEvents: 'none',
    }}>
      {/* Label */}
      <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1 }}>SHARDS</div>
      {/* 6 diamonds in a 2×3 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 12px)', gap: 3 }}>
        {Array.from({ length: SHARD_MAX }).map((_, i) => {
          const active = i < chainLen;
          return (
            <div key={i} style={{
              width: 10, height: 10,
              transform: 'rotate(45deg)',
              background: active ? activeColor : 'transparent',
              border: `1px solid ${active ? activeColor : GH.boneFaint}`,
              boxShadow: active ? `0 0 6px ${activeGlow}` : 'none',
              transition: 'all 0.15s ease',
            }} />
          );
        })}
      </div>
      <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.boneDim }}>
        {chainLen}<span style={{ color: GH.goldDim }}>/{SHARD_MAX}</span>
      </div>
    </div>
  );
}

// ── Class Selector (Paladin / Bard / Rogue) ───────────────────────────────────

const CLASS_DEFS = [
  { id: 'paladin', label: 'PAL', icon: '⚔', color: GH.gold,    glow: GH.goldGlow,    desc: 'Sacred' },
  { id: 'bard',    label: 'BRD', icon: '♪', color: GH.magenta, glow: GH.magentaGlow, desc: 'Rhythm' },
  { id: 'rogue',   label: 'RGE', icon: '◆', color: GH.cyan,    glow: GH.cyanGlow,    desc: 'Stealth' },
] as const;

type DiceClass = typeof CLASS_DEFS[number]['id'];

interface ClassSelectorProps { selected: DiceClass; onSelect: (c: DiceClass) => void; }

function ClassSelector({ selected, onSelect }: ClassSelectorProps) {
  return (
    <div style={{
      position: 'absolute', top: 82, left: 8,
      display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'auto',
    }}>
      <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1, textAlign: 'center' }}>CLASS</div>
      {CLASS_DEFS.map(c => {
        const isActive = selected === c.id;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} style={{
            background: isActive ? `rgba(${hexToRgb(c.color)},0.18)` : GH.panelBg,
            border: `1px solid ${isActive ? c.color : GH.goldDim}`,
            color: isActive ? c.color : GH.boneDim,
            borderRadius: 4, padding: '3px 6px',
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            cursor: 'pointer', letterSpacing: 0.5,
            boxShadow: isActive ? `0 0 8px ${c.glow}` : 'none',
            textShadow: isActive ? `0 0 6px ${c.glow}` : 'none',
            transition: 'all 0.15s ease',
            display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
          }}>
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return '255,255,255';
  return m.map(h => parseInt(h, 16)).join(',');
}

// ── Hidden Pocket ─────────────────────────────────────────────────────────────

function HiddenPocket() {
  const [open, setOpen] = useState(false);
  const [heldFace, setHeldFace] = useState<number | null>(null);
  const chainFaces = useFarkleStore(s => s.chainFaces);
  const lastFace = chainFaces[chainFaces.length - 1] ?? null;

  function stashFace() {
    if (lastFace !== null) setHeldFace(lastFace);
  }
  function releaseFace() { setHeldFace(null); }

  const faceColor = heldFace ? FACE_COLOR[heldFace] ?? GH.purpleMid : GH.boneFaint;

  return (
    <div style={{
      position: 'absolute', bottom: 110, left: 8, pointerEvents: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
    }}>
      {/* Latch toggle */}
      <button onClick={() => setOpen(o => !o)} style={{
        background: open ? `rgba(201,168,76,0.16)` : GH.panelBg,
        border: `1px solid ${open ? GH.gold : GH.goldDim}`,
        color: open ? GH.gold : GH.goldDim,
        borderRadius: 4, padding: '3px 7px', fontSize: 8, fontFamily: 'monospace',
        cursor: 'pointer', letterSpacing: 1,
        boxShadow: open ? `0 0 8px ${GH.goldGlow}` : 'none',
        textShadow: open ? `0 0 6px ${GH.goldGlow}` : 'none',
        transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>{open ? '▲' : '▼'}</span> POCKET
      </button>

      {/* Deployable pocket panel */}
      {open && (
        <div style={{
          background: GH.panelBg,
          border: `1px solid ${GH.panelBorder}`,
          borderRadius: 4, padding: '6px 8px',
          display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center',
          animation: 'pocketOpen 0.2s ease-out',
          position: 'relative', minWidth: 60,
        }}>
          <div style={CRT_STYLE} />
          <GhCorners />
          <div style={{ fontSize: 7, color: GH.goldDim, fontFamily: 'monospace', letterSpacing: 1 }}>HELD</div>
          {/* Held die slot */}
          <div style={{
            width: 36, height: 36, borderRadius: 6,
            background: heldFace ? `${faceColor}22` : 'rgba(5,0,18,0.7)',
            border: `1px solid ${heldFace ? faceColor : GH.boneFaint}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: heldFace ? faceColor : GH.boneFaint,
            fontFamily: 'monospace',
            boxShadow: heldFace ? `0 0 10px ${faceColor}88` : 'none',
          }}>
            {heldFace ?? '—'}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {lastFace !== null && !heldFace && (
              <button onClick={stashFace} style={{
                background: `rgba(201,168,76,0.1)`, border: `1px solid ${GH.goldDim}`,
                color: GH.gold, borderRadius: 3, padding: '2px 5px', fontSize: 7,
                cursor: 'pointer', fontFamily: 'monospace',
              }}>STASH</button>
            )}
            {heldFace !== null && (
              <button onClick={releaseFace} style={{
                background: `rgba(239,68,68,0.1)`, border: `1px solid ${GH.dangerGlow}`,
                color: GH.danger, borderRadius: 3, padding: '2px 5px', fontSize: 7,
                cursor: 'pointer', fontFamily: 'monospace',
              }}>PURGE</button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes pocketOpen { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }`}</style>
    </div>
  );
}

// ── Beat Window ───────────────────────────────────────────────────────────────
// Module-level beat phase — sampled by getCurrentBeatAccuracy() on chain commit.
let _currentBeatPhase = 0;

export function getCurrentBeatAccuracy(windowFactor = 1.0): 'PERFECT' | 'GOOD' | 'MISS' {
  const dist = Math.abs(_currentBeatPhase - PERFECT_ZONE);
  if (dist === 0) return 'PERFECT';
  if (dist <= Math.max(1, Math.round(windowFactor * 1.5))) return 'GOOD';
  return 'MISS';
}

function BeatWindow() {
  const mode = useFarkleStore(s => s.mode);
  const energy = useFarkleStore(s => s.energy);
  const [beatPhase, setBeatPhase] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState<'PERFECT' | 'GOOD' | null>(null);

  // Beat tempo tied to energy level
  const bpm = 60 + (energy / MAX_ENERGY) * 120; // 60–180 BPM
  const beatMs = Math.round((60 / bpm) * 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setBeatPhase(p => {
        const next = (p + 1) % BEAT_MARKERS;
        _currentBeatPhase = next;  // keep module-level ref in sync
        return next;
      });
    }, beatMs);
    return () => clearInterval(interval);
  }, [beatMs]);

  const trackColor =
    mode === 'FRENZY' ? GH.cyan :
    mode === 'PRIME'  ? GH.magenta :
    GH.gold;

  const perfectZone = PERFECT_ZONE;

  return (
    <div style={{
      height: 42,
      background: GH.panelBg,
      borderTop: `1px solid ${GH.panelBorder}`,
      display: 'flex', alignItems: 'center',
      padding: '0 8px', gap: 6, flexShrink: 0, position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={CRT_STYLE} />
      <GhCorners />

      {/* Label */}
      <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1, flexShrink: 0 }}>
        BEAT
      </div>

      {/* Beat marker track */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, height: 30, position: 'relative' }}>
        {/* Perfect zone highlight */}
        <div style={{
          position: 'absolute',
          left: `${(perfectZone / BEAT_MARKERS) * 100}%`,
          width: `${100 / BEAT_MARKERS}%`,
          top: 2, bottom: 2,
          background: mode === 'FRENZY' ? `rgba(0,229,255,0.15)` : mode === 'PRIME' ? `rgba(255,0,204,0.12)` : `rgba(201,168,76,0.1)`,
          border: `1px solid ${mode === 'FRENZY' ? GH.crystalBorder : mode === 'PRIME' ? GH.magenta : GH.gold}`,
          borderRadius: 2,
          boxShadow: mode !== 'NORMAL' ? `0 0 8px ${mode === 'FRENZY' ? GH.cyanGlow : GH.magentaGlow}` : 'none',
          zIndex: 0,
        }} />
        <div style={{
          position: 'absolute',
          left: `${(perfectZone / BEAT_MARKERS) * 100 + (100 / BEAT_MARKERS) / 2}%`,
          top: -2, transform: 'translateX(-50%)',
          fontSize: 6, fontFamily: 'monospace', color: trackColor,
          textShadow: `0 0 6px ${trackColor}`, letterSpacing: 1,
          zIndex: 2,
        }}>PERFECT</div>

        {Array.from({ length: BEAT_MARKERS }).map((_, i) => {
          const isActive = i === beatPhase;
          const isPerfect = i === perfectZone && isActive;
          return (
            <div key={i} style={{
              flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: i % 2 === 0 ? 2 : 1,
                height: i % 2 === 0 ? '65%' : '40%',
                background: isActive
                  ? (isPerfect ? GH.cyanBright : trackColor)
                  : GH.boneFaint,
                borderRadius: 1,
                boxShadow: isActive ? `0 0 8px ${isPerfect ? GH.cyanGlow : trackColor}` : 'none',
                transition: 'all 0.06s ease',
              }} />
            </div>
          );
        })}
      </div>

      {/* BPM readout */}
      <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.goldDim, flexShrink: 0, textAlign: 'right', minWidth: 32 }}>
        {Math.round(bpm)}<br />BPM
      </div>
    </div>
  );
}

// ── Chain Preview ─────────────────────────────────────────────────────────────

function ChainPreview() {
  const { chain, chainFaces, chainScore, multiplierStep } = useFarkleStore(s => ({
    chain: s.chain, chainFaces: s.chainFaces, chainScore: s.chainScore,
    multiplierStep: s.multiplierStep,
  }));

  if (chain.length === 0) return null;
  const isFarkle = chainScore === 0;
  const mult = MULTIPLIER_LADDER[Math.min(multiplierStep, 5)] ?? 1;
  const preview = Math.round(chainScore * mult);

  return (
    <div style={{
      position: 'absolute', bottom: 110, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: GH.panelBg, border: `1px solid ${GH.panelBorder}`,
        borderRadius: 6, padding: '6px 10px', position: 'relative',
      }}>
        <div style={CRT_STYLE} />
        <GhCorners />
        <div style={{ display: 'flex', gap: 5, marginBottom: 4, position: 'relative', zIndex: 1 }}>
          {chainFaces.map((face, i) => (
            <div key={i} style={{
              width: 30, height: 30, borderRadius: 5,
              background: `${FACE_COLOR[face] ?? GH.purpleMid}22`,
              border: `1px solid ${FACE_COLOR[face] ?? GH.purpleMid}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: FACE_COLOR[face] ?? GH.purpleMid,
              fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
              boxShadow: `0 0 10px ${FACE_COLOR[face] ?? GH.purpleMid}bb, 0 0 4px ${FACE_COLOR[face] ?? GH.purpleMid}66`,
              textShadow: `0 0 8px ${FACE_COLOR[face] ?? GH.purpleMid}`,
            }}>
              {face}
            </div>
          ))}
        </div>
        <div style={{
          color: isFarkle ? GH.danger : GH.goldBright,
          fontSize: 13, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center',
          textShadow: isFarkle ? `0 0 10px ${GH.dangerGlow}` : `0 0 8px ${GH.goldGlow}`,
          position: 'relative', zIndex: 1,
        }}>
          {isFarkle ? '✦ FARKLE ✦' : `+${preview.toLocaleString()}`}
        </div>
      </div>
    </div>
  );
}

// ── Bank Button (Gothic) ──────────────────────────────────────────────────────

function BankButton({ onBank, onBack, onPass }: { onBank: () => void; onBack: () => void; onPass?: () => void }) {
  const { unbanked, rallyRole } = useFarkleStore(s => ({ unbanked: s.unbanked, rallyRole: s.rallyRole }));

  return (
    <div style={{ position: 'absolute', top: 82, right: 8, display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'auto' }}>
      {unbanked > 0 && (
        <button onClick={onBank} style={{
          background: `rgba(201,168,76,0.16)`,
          border: `1px solid ${GH.gold}`,
          color: GH.goldBright,
          borderRadius: 5, padding: '6px 12px',
          fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
          boxShadow: `0 0 14px ${GH.goldGlow}`,
          textShadow: `0 0 8px ${GH.goldGlow}`,
          letterSpacing: 1,
        }}>
          ⚑ BANK {unbanked.toLocaleString()}
        </button>
      )}
      {onPass && unbanked > 0 && (
        <button onClick={onPass} style={{
          background: rallyRole === 'CONDUCTOR' ? 'rgba(123,47,255,0.16)' : GH.panelBg,
          border: `1px solid ${rallyRole === 'CONDUCTOR' ? GH.purpleMid : GH.goldDim}`,
          color: rallyRole === 'CONDUCTOR' ? '#a78bfa' : GH.boneDim,
          borderRadius: 5, padding: '4px 10px',
          fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
        }}>
          PASS{rallyRole === 'CONDUCTOR' ? ' +STEP' : ''}
        </button>
      )}
      <button onClick={onBack} style={{
        background: GH.panelBg,
        border: `1px solid ${GH.goldDim}`,
        color: GH.boneDim,
        borderRadius: 5, padding: '4px 10px',
        fontSize: 10, cursor: 'pointer', fontFamily: 'monospace',
        letterSpacing: 0.5,
      }}>
        ← EXIT
      </button>
    </div>
  );
}

// ── Timer Display ─────────────────────────────────────────────────────────────

function TimerDisplay() {
  const timeRemaining = useFarkleStore(s => s.timeRemaining);
  if (timeRemaining === null) return null;
  const secs = Math.ceil(timeRemaining);
  const isLow = secs <= 30;
  return (
    <div style={{
      position: 'absolute', top: 82, left: 8,
      color: isLow ? GH.danger : GH.bone,
      fontSize: isLow ? 18 : 14, fontFamily: 'monospace', fontWeight: 700,
      textShadow: isLow ? `0 0 12px ${GH.dangerGlow}` : `0 0 6px ${GH.boneDim}`,
      pointerEvents: 'none',
      animation: isLow && secs % 2 === 0 ? 'timerPulse 1s ease infinite' : 'none',
      letterSpacing: 1,
    }}>
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      <style>{`@keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  RAINMAKER: GH.goldBright, HEADHUNTER: GH.danger,
  ARCHIVIST: '#10b981',     CONDUCTOR: GH.purpleMid,
};

function RoleBadge() {
  const rallyRole = useFarkleStore(s => s.rallyRole);
  if (!rallyRole) return null;
  const c = ROLE_COLORS[rallyRole] ?? GH.bone;
  return (
    <div style={{
      position: 'absolute', top: 108, left: 8,
      color: c, fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: 2, pointerEvents: 'none',
      textShadow: `0 0 8px ${c}`,
      background: `${c}18`, border: `1px solid ${c}55`,
      borderRadius: 3, padding: '2px 6px',
    }}>
      ◈ {rallyRole}
    </div>
  );
}

// ── Disruption Panel ──────────────────────────────────────────────────────────

const DISRUPTION_DEFS: { type: DisruptionType; label: string; icon: string }[] = [
  { type: 'ice_send',  label: 'ICE',      icon: '❄' },
  { type: 'lock_send', label: 'LOCK',     icon: '⧖' },
  { type: 'scramble',  label: 'SCRAMBLE', icon: '⟳' },
];

const MODE_LABEL: Partial<Record<GameMode, string>> = {
  VS_FREE: 'VS', VS_CASINO: 'VS',
  HEIST_FREE: 'HEIST', HEIST_CASINO: 'HEIST',
};

function DisruptionPanel({ onDisrupt, gameMode }: { onDisrupt: (type: DisruptionType) => void; gameMode: GameMode }) {
  const { disruptCharges, disruptChargeProgress, mode } = useFarkleStore(s => ({
    disruptCharges: s.disruptCharges,
    disruptChargeProgress: s.disruptChargeProgress,
    mode: s.mode,
  }));
  const spendDisruptCharge = useFarkleStore(s => s.spendDisruptCharge);

  const isHeist = gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO';
  const isFrenzy = mode === 'FRENZY';

  function fireDisrupt(type: DisruptionType) {
    if (isHeist && isFrenzy) { onDisrupt(type); return; }
    if (disruptCharges <= 0) return;
    if (!spendDisruptCharge()) return;
    onDisrupt(type);
  }

  const hasCharge = disruptCharges > 0 || (isHeist && isFrenzy);

  return (
    <div style={{
      position: 'absolute', bottom: 110, right: 8,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'auto', alignItems: 'flex-end',
    }}>
      {/* Mode badge */}
      <div style={{
        fontSize: 8, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
        color: GH.purpleMid, textShadow: `0 0 6px ${GH.purpleGlow}`,
        background: GH.panelBg, border: `1px solid ${GH.purpleDim}`,
        borderRadius: 3, padding: '1px 5px',
      }}>
        {MODE_LABEL[gameMode]} MODE
      </div>
      {/* Charge meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 9, height: 9, borderRadius: '50%',
            background: i < disruptCharges
              ? GH.purpleMid
              : i === disruptCharges
                ? `conic-gradient(${GH.purpleMid} ${disruptChargeProgress}%, ${GH.purpleDim} ${disruptChargeProgress}%)`
                : GH.purpleDim,
            border: `1px solid ${GH.purpleMid}55`,
            boxShadow: i < disruptCharges ? `0 0 5px ${GH.purpleGlow}` : 'none',
          }} />
        ))}
        <span style={{
          fontSize: 8, fontFamily: 'monospace',
          color: isHeist && isFrenzy ? '#22c55e' : isFrenzy ? GH.purpleMid : GH.boneFaint,
        }}>
          {isHeist ? (isFrenzy ? 'FREE' : '?FRENZY') : (isFrenzy ? 'CHARGE' : 'NEED FRENZY')}
        </span>
      </div>
      {DISRUPTION_DEFS.map(({ type, label, icon }) => (
        <button key={type} onClick={() => fireDisrupt(type)} disabled={!hasCharge} style={{
          background: hasCharge ? `rgba(123,47,255,0.2)` : GH.panelBg,
          border: `1px solid ${hasCharge ? GH.purpleMid : GH.purpleDim}`,
          color: hasCharge ? '#e9d5ff' : GH.boneFaint,
          borderRadius: 5, padding: '4px 8px',
          fontSize: 10, fontWeight: 700, cursor: hasCharge ? 'pointer' : 'default',
          fontFamily: 'monospace', whiteSpace: 'nowrap',
          boxShadow: hasCharge ? `0 0 8px ${GH.purpleGlow}` : 'none',
          transition: 'all 0.15s ease', letterSpacing: 0.5,
        }}>
          {icon} {label}
        </button>
      ))}
    </div>
  );
}

// ── Disruption Toast ──────────────────────────────────────────────────────────

function DisruptionToast() {
  const pendingDisruption = useFarkleStore(s => s.pendingDisruption);
  const dismissDisruption = useFarkleStore(s => s.dismissDisruption);

  if (!pendingDisruption) return null;

  const labels: Record<string, string> = {
    ice_send:  '❄ ICE incoming!',
    lock_send: '⧖ LOCK incoming!',
    scramble:  '⟳ Scramble incoming!',
  };

  return (
    <div style={{
      position: 'absolute', top: 82, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30,0,60,0.95)', border: `1px solid ${GH.magenta}`,
      borderRadius: 8, padding: '7px 18px',
      color: GH.magenta, fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
      boxShadow: `0 0 18px ${GH.magentaGlow}`,
      textShadow: `0 0 8px ${GH.magentaGlow}`,
      animation: 'disruptIn 0.3s ease-out',
      pointerEvents: 'auto', zIndex: 10,
      display: 'flex', gap: 12, alignItems: 'center', letterSpacing: 1,
    }}>
      {labels[pendingDisruption.type] ?? 'Disruption incoming!'}
      <button onClick={dismissDisruption} style={{
        background: 'transparent', border: 'none', color: GH.magentaDim,
        cursor: 'pointer', fontFamily: 'monospace', fontSize: 12,
      }}>✕</button>
      <style>{`
        @keyframes disruptIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Frenzy Instability Warning ────────────────────────────────────────────────

function FrenzyInstabilityWarning() {
  const { mode, energy } = useFarkleStore(s => ({ mode: s.mode, energy: s.energy }));
  if (mode !== 'FRENZY' || energy >= FRENZY_INSTABILITY_THRESHOLD) return null;
  const critical = energy < 30;
  return (
    <div style={{
      position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 6,
      background: critical ? 'rgba(200,0,0,0.22)' : 'rgba(200,100,0,0.16)',
      border: `1px solid ${critical ? GH.danger : GH.amberHot}`,
      borderRadius: 6, padding: '4px 14px',
      pointerEvents: 'none',
      animation: 'instabilityPulse 0.9s ease-in-out infinite',
      zIndex: 5,
    }}>
      <span style={{ fontSize: 12 }}>⚡</span>
      <span style={{
        color: critical ? GH.danger : GH.amberHot,
        fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
        textShadow: `0 0 10px ${critical ? GH.dangerGlow : GH.amberGlow}`,
      }}>
        {critical ? 'ANCHOR CRITICAL' : 'ANCHOR UNSTABLE'}
      </span>
      <style>{`
        @keyframes instabilityPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

// ── RAINMAKER Face Picker ─────────────────────────────────────────────────────

interface RainmakerFacePickerProps { onSelect: (face: number) => void; }

function RainmakerFacePicker({ onSelect }: RainmakerFacePickerProps) {
  const pendingId = useFarkleStore(s => s.pendingRainmakerBombId);
  if (!pendingId) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,0,18,0.72)', pointerEvents: 'auto', zIndex: 20,
    }}>
      <div style={{
        background: GH.panelBg, border: `1px solid ${GH.gold}`,
        borderRadius: 10, padding: '20px 24px', textAlign: 'center',
        boxShadow: `0 0 30px ${GH.goldGlow}`, position: 'relative',
      }}>
        <div style={CRT_STYLE} />
        <GhCorners color={GH.goldBright} />
        <div style={{ color: GH.gold, fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 4, position: 'relative', zIndex: 1 }}>
          ⚡ RAINMAKER
        </div>
        <div style={{ color: GH.boneDim, fontFamily: 'monospace', fontSize: 9, letterSpacing: 1, marginBottom: 14, position: 'relative', zIndex: 1 }}>
          SELECT TARGET FACE
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
          {[1, 2, 3, 4, 5, 6].map(f => (
            <button key={f} onClick={() => onSelect(f)} style={{
              width: 42, height: 42, borderRadius: 6,
              background: `${FACE_COLOR[f] ?? '#888'}22`,
              border: `2px solid ${FACE_COLOR[f] ?? '#888'}`,
              color: FACE_COLOR[f] ?? '#fff', fontWeight: 700, fontSize: 18,
              cursor: 'pointer', fontFamily: 'monospace',
              boxShadow: `0 0 10px ${FACE_COLOR[f] ?? '#888'}66`,
              textShadow: `0 0 6px ${FACE_COLOR[f] ?? '#888'}`,
              transition: 'all 0.15s ease',
            }}>{f}</button>
          ))}
        </div>
        <FiligreeRow count={7} color={GH.goldDim} />
      </div>
    </div>
  );
}

// ── Heist Panel ───────────────────────────────────────────────────────────────

function HeistPanel({ onInitiate, onBlock }: { onInitiate: () => void; onBlock: () => void }) {
  const vaultPts     = useFarkleStore(s => s.vaultPts);
  const heistActive  = useFarkleStore(s => s.heistActive);
  const heistExpires = useFarkleStore(s => s.heistExpiresAt);
  const energy       = useFarkleStore(s => s.energy);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!heistActive || heistExpires === null) return;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((heistExpires - Date.now()) / 1000));
      setCountdown(rem);
    }, 200);
    return () => clearInterval(id);
  }, [heistActive, heistExpires]);

  const pct = Math.min(1, vaultPts / HEIST_CONSTANTS.VAULT_THRESHOLD);
  const canInitiate = !heistActive && vaultPts >= HEIST_CONSTANTS.VAULT_THRESHOLD && energy >= HEIST_CONSTANTS.HEIST_ENERGY_COST;

  return (
    <div style={{ position: 'absolute', bottom: 160, left: 8, pointerEvents: 'auto', minWidth: 130 }}>
      <div style={{
        background: GH.panelBg, border: `1px solid ${GH.purpleMid}55`,
        borderRadius: 5, padding: '6px 8px', position: 'relative',
      }}>
        <div style={CRT_STYLE} />
        <GhCorners color={GH.purpleMid} />
        <div style={{ fontSize: 8, color: GH.purpleMid, marginBottom: 4, letterSpacing: 2, textShadow: `0 0 6px ${GH.purpleGlow}`, position: 'relative', zIndex: 1 }}>⬡ VAULT</div>
        <div style={{ background: 'rgba(13,0,24,0.8)', borderRadius: 3, height: 8, width: '100%', overflow: 'hidden', border: `1px solid ${GH.purpleDim}`, position: 'relative', zIndex: 1 }}>
          <div style={{ height: '100%', width: `${pct * 100}%`, background: pct >= 1 ? GH.purpleMid : '#4f46e5', transition: 'width 0.3s', boxShadow: pct >= 1 ? `0 0 8px ${GH.purpleGlow}` : 'none' }} />
        </div>
        <div style={{ fontSize: 8, color: GH.purpleMid, marginTop: 2, position: 'relative', zIndex: 1 }}>{vaultPts.toLocaleString()} / {HEIST_CONSTANTS.VAULT_THRESHOLD.toLocaleString()}</div>
        {canInitiate && (
          <button onClick={onInitiate} style={{ marginTop: 5, padding: '3px 8px', background: `rgba(123,47,255,0.25)`, color: '#c4b5fd', border: `1px solid ${GH.purpleMid}`, borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 1, boxShadow: `0 0 8px ${GH.purpleGlow}` }}>
            HEIST (−{HEIST_CONSTANTS.HEIST_ENERGY_COST}⚡)
          </button>
        )}
        {heistActive && (
          <button onClick={onBlock} style={{ marginTop: 5, padding: '3px 8px', background: 'rgba(239,68,68,0.22)', color: '#fca5a5', border: `1px solid ${GH.danger}`, borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace', animation: 'pulse 0.5s infinite alternate' }}>
            BLOCK ({countdown}s)
          </button>
        )}
      </div>
    </div>
  );
}

// ── Rally Decision Panel ──────────────────────────────────────────────────────

function RallyDecisionPanel({ onRallyBank, onRallyPass, onRallyContinue }: { onRallyBank: () => void; onRallyPass: () => void; onRallyContinue: () => void }) {
  const active  = useFarkleStore(s => s.rallyDecisionActive);
  const expires = useFarkleStore(s => s.rallyDecisionExpiresAt);
  const rallyVotes = useFarkleStore(s => s.rallyVotes);
  const [countdown, setCountdown] = useState(3);
  const [myVote, setMyVote] = useState<'bank' | 'pass' | 'continue' | null>(null);

  useEffect(() => {
    if (!active || expires === null) return;
    setMyVote(null);
    const id = setInterval(() => {
      setCountdown(Math.max(0, Math.ceil((expires - Date.now()) / 1000)));
    }, 100);
    return () => clearInterval(id);
  }, [active, expires]);

  if (!active) return null;

  const voteEntries = Object.entries(rallyVotes);
  const voteColor: Record<string, string> = { bank: '#059669', pass: GH.purpleMid, continue: '#1d4ed8' };

  function handleVote(choice: 'bank' | 'pass' | 'continue', fn: () => void) {
    if (myVote) return;
    setMyVote(choice);
    fn();
  }

  return (
    <div style={{
      position: 'absolute', bottom: '28%', left: '50%', transform: 'translateX(-50%)',
      pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: GH.panelBg, border: `1px solid ${GH.purpleMid}88`,
      borderRadius: 10, padding: '12px 20px',
      boxShadow: `0 0 20px ${GH.purpleGlow}`,
    }}>
      <div style={CRT_STYLE} />
      <GhCorners color={GH.purpleMid} />
      <div style={{ color: GH.purpleMid, fontSize: 10, letterSpacing: 2, textShadow: `0 0 8px ${GH.purpleGlow}`, position: 'relative', zIndex: 1 }}>
        ◈ RALLY DECISION — {countdown}s
      </div>
      <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
        {(['bank', 'pass', 'continue'] as const).map((choice, idx) => {
          const colors = ['#059669', GH.purpleMid, '#1d4ed8'];
          const labels = ['BANK', 'PASS', 'CONTINUE'];
          const fn = ([onRallyBank, onRallyPass, onRallyContinue] as const)[idx as 0|1|2];
          const c = colors[idx];
          const isVoted = myVote === choice;
          return (
            <button key={choice}
              onClick={() => handleVote(choice, fn)}
              disabled={!!myVote}
              style={{
                padding: '5px 12px',
                background: isVoted ? `${c}33` : myVote ? GH.panelBg : `${c}22`,
                color: isVoted ? '#fff' : myVote && !isVoted ? GH.boneFaint : '#fff',
                border: `1px solid ${isVoted ? c : myVote ? GH.goldDim : c}88`,
                borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: myVote ? 'default' : 'pointer',
                fontFamily: 'monospace', letterSpacing: 1,
                opacity: myVote && !isVoted ? 0.45 : 1,
                boxShadow: isVoted ? `0 0 10px ${c}88` : 'none',
              }}>
              {labels[idx]}
            </button>
          );
        })}
      </div>
      {voteEntries.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 2, position: 'relative', zIndex: 1 }}>
          {voteEntries.map(([pid, v]) => (
            <div key={pid} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: voteColor[v] ?? GH.panelBg, color: '#fff', letterSpacing: 1, fontWeight: 700, fontFamily: 'monospace' }}>
              {v.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vitality Drip (Life-Force Regen) ─────────────────────────────────────────
// Shows real-time energy drain/regen rate with an animated drip vial.
// PRIME mode drips fill the vial; FRENZY mode drains it with a bleed effect.

function VitalityDripPanel() {
  const { energy, mode } = useFarkleStore(s => ({ energy: s.energy, mode: s.mode }));
  const [dripIds, setDripIds] = useState<number[]>([]);
  const dripCounter = useRef(0);

  const drainRate = mode === 'FRENZY' ? (energy < 75 ? -3 : -5) : mode === 'PRIME' ? 5 : 0;
  const isRegen = drainRate > 0;
  const isDrain = drainRate < 0;

  useEffect(() => {
    if (!isRegen) return;
    const id = setInterval(() => {
      const did = ++dripCounter.current;
      setDripIds(d => [...d.slice(-4), did]);
      setTimeout(() => setDripIds(d => d.filter(x => x !== did)), 1500);
    }, 380);
    return () => clearInterval(id);
  }, [isRegen]);

  const vialColor = isDrain
    ? `linear-gradient(0deg, ${GH.danger}, rgba(239,68,68,0.35))`
    : isRegen
      ? `linear-gradient(0deg, ${GH.cyan}, rgba(0,229,255,0.3))`
      : `linear-gradient(0deg, ${GH.gold}55, ${GH.gold}22)`;
  const borderClr = isDrain ? GH.danger : isRegen ? GH.cyan : GH.goldDim;
  const glowClr   = isDrain ? GH.dangerGlow : isRegen ? GH.cyanGlow : GH.goldDim;
  const rateLabel = isDrain ? `${drainRate}/s` : isRegen ? `+${drainRate}/s` : 'IDLE';
  const statusLabel = isDrain ? 'DRAIN' : isRegen ? 'REGEN' : 'STABLE';

  return (
    <div style={{
      position: 'absolute', bottom: 200, left: 8,
      pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{
        background: GH.panelBg,
        border: `1px solid ${borderClr}44`,
        borderRadius: 4, padding: '4px 7px',
        position: 'relative', minWidth: 52, textAlign: 'center',
        boxShadow: `0 0 10px ${glowClr}`,
        overflow: 'hidden',
      }}>
        <div style={CRT_STYLE} />
        <GhCorners color={borderClr} />
        <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1, marginBottom: 3, position: 'relative', zIndex: 1 }}>
          VITALITY
        </div>
        {/* Vial */}
        <div style={{
          width: 18, height: 38, background: 'rgba(5,0,18,0.85)',
          border: `1px solid ${borderClr}66`,
          borderRadius: '1px 1px 6px 6px',
          margin: '0 auto 3px', position: 'relative', overflow: 'hidden', zIndex: 1,
        }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${(energy / MAX_ENERGY) * 100}%`,
            background: vialColor,
            transition: 'height 0.25s linear',
            boxShadow: `0 0 8px ${glowClr}`,
          }} />
          {/* Animated drip drops during regen */}
          {dripIds.map(did => (
            <div key={did} style={{
              position: 'absolute', top: 0,
              left: `${18 + (did % 4) * 14}%`,
              width: 3, height: 5,
              borderRadius: '50% 50% 50% 50% / 30% 30% 70% 70%',
              background: GH.cyan,
              boxShadow: `0 0 3px ${GH.cyanGlow}`,
              animation: 'vDrip 1.5s ease-in forwards',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 7, fontFamily: 'monospace', color: borderClr, position: 'relative', zIndex: 1, textShadow: `0 0 5px ${glowClr}` }}>
          {statusLabel}
        </div>
        <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.boneDim, position: 'relative', zIndex: 1 }}>
          {rateLabel}
        </div>
      </div>
      <style>{`
        @keyframes vDrip {
          0%   { transform: translateY(0);   opacity: 0.9; }
          100% { transform: translateY(38px); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}

// ── Shard Faucet ──────────────────────────────────────────────────────────────
// Tracks "Soul Shards" accumulated from banked score milestones (every 20k pts).
// A partial-fill bar shows progress toward the next shard.
// Visual style: textured Gothic panel with mode-reactive glow — non-minimalist.

function ShardFaucetPanel() {
  const { banked, mode } = useFarkleStore(s => ({ banked: s.banked, mode: s.mode }));

  const MILESTONE = 20_000;
  const MAX_SHARDS = 5;
  const earnedShards = Math.min(MAX_SHARDS, Math.floor(banked / MILESTONE));
  const partial = (banked % MILESTONE) / MILESTONE;

  const activeColor = mode === 'FRENZY' ? GH.magenta : mode === 'PRIME' ? GH.cyan : GH.gold;
  const activeGlow  = mode === 'FRENZY' ? GH.magentaGlow : mode === 'PRIME' ? GH.cyanGlow : GH.goldGlow;

  return (
    <div style={{
      position: 'absolute', bottom: 200, right: 8,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: GH.panelBg,
        border: `1px solid ${GH.goldDim}`,
        borderRadius: 4, padding: '4px 7px',
        position: 'relative', textAlign: 'center',
        boxShadow: `0 0 8px ${activeGlow}`,
      }}>
        <div style={CRT_STYLE} />
        <GhCorners />
        <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.goldDim, letterSpacing: 1, marginBottom: 3, position: 'relative', zIndex: 1 }}>
          SOUL FAUCET
        </div>
        {/* 5 shard diamonds */}
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', position: 'relative', zIndex: 1, marginBottom: 3 }}>
          {Array.from({ length: MAX_SHARDS }).map((_, i) => {
            const filled = i < earnedShards;
            const isNext = i === earnedShards && earnedShards < MAX_SHARDS;
            const partialOpacity = isNext ? Math.floor(partial * 255).toString(16).padStart(2, '0') : '00';
            return (
              <div key={i} style={{
                width: 9, height: 9,
                transform: 'rotate(45deg)',
                background: filled ? activeColor : isNext ? `${activeColor}${partialOpacity}` : 'transparent',
                border: `1px solid ${filled || isNext ? activeColor : GH.boneFaint}`,
                boxShadow: filled ? `0 0 6px ${activeGlow}` : 'none',
                transition: 'all 0.25s ease',
              }} />
            );
          })}
        </div>
        {/* Fill bar toward next shard */}
        <div style={{
          width: '100%', height: 2, background: GH.boneFaint,
          borderRadius: 1, overflow: 'hidden', position: 'relative', zIndex: 1,
        }}>
          <div style={{
            height: '100%',
            width: `${earnedShards >= MAX_SHARDS ? 100 : partial * 100}%`,
            background: `linear-gradient(90deg, ${activeColor}, ${activeColor}88)`,
            boxShadow: `0 0 4px ${activeGlow}`,
            transition: 'width 0.3s ease', borderRadius: 1,
          }} />
        </div>
        <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.goldDim, marginTop: 2, position: 'relative', zIndex: 1 }}>
          {earnedShards}/{MAX_SHARDS} SHARDS
        </div>
        <FiligreeRow count={3} color={GH.goldDim} />
      </div>
    </div>
  );
}

// ── Horror Heartbeat — atmospheric vignette + ERK tense on farkle ────────────

function HorrorHeartbeat() {
  const farkleCount = useFarkleStore(s => s.farkleCount);
  const chainScore = useFarkleStore(s => s.chainScore);
  const chainFaces = useFarkleStore(s => s.chainFaces);
  const prevFarkle = useRef(0);
  const [farkleFlash, setFarkleFlash] = useState(false);
  const tensionMode = chainFaces.length >= 2 && chainScore === 0;

  useEffect(() => {
    if (farkleCount > prevFarkle.current) {
      prevFarkle.current = farkleCount;
      setFarkleFlash(true);
      setMusicState('tense' as EmotionalState);
      const t = setTimeout(() => setFarkleFlash(false), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [farkleCount]);

  if (!tensionMode && !farkleFlash) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
      boxShadow: farkleFlash
        ? 'inset 0 0 60px rgba(239,68,68,0.5), inset 0 0 120px rgba(239,68,68,0.25)'
        : 'inset 0 0 40px rgba(239,68,68,0.2)',
      animation: farkleFlash ? 'horrorPulse 1.2s ease-out forwards' : 'horrorIdle 1.5s ease-in-out infinite',
    }}>
      <style>{`
        @keyframes horrorPulse { 0% { opacity: 1; } 40% { opacity: 0.8; } 100% { opacity: 0; } }
        @keyframes horrorIdle { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}

// ── Main HUD ──────────────────────────────────────────────────────────────────

const DISRUPTION_MODES = new Set<GameMode>(['VS_FREE', 'VS_CASINO', 'HEIST_FREE', 'HEIST_CASINO']);

// ── DraftPanel — Roguelike facet picker (Feature I) ───────────────────────────
// Shown after each bank. Player picks one of 3 facets or skips.
// Auto-dismisses after 10s with no action (retains current facet).

function DraftPanel({
  options, tier, onPick, onSkip,
}: {
  options: FacetId[];
  tier: 1 | 2;
  onPick: (id: FacetId) => void;
  onSkip: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(10);
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => {
      if (s <= 1) { onSkip(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onSkip]);

  return (
    <div style={{
      position: 'absolute', bottom: 160, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, pointerEvents: 'auto',
      animation: 'draft-slide-in 0.25s ease',
    }}>
      <div style={{
        background: GH.panelBg, border: `1px solid ${GH.goldGlow}`,
        borderRadius: 8, padding: '10px 12px', minWidth: 260, position: 'relative',
      }}>
        <GhCorners />
        <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.gold, letterSpacing: 3, marginBottom: 8, textAlign: 'center' }}>
          ✦ FACET DRAFT {tier === 2 ? '· TIER II' : ''} · {timeLeft}s ✦
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {options.map(id => {
            const def = FACET_MAP.get(id);
            if (!def) return null;
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                style={{
                  flex: 1, background: GH.crystalFace,
                  border: `1px solid ${GH.crystalBorder}`,
                  borderRadius: 6, padding: '8px 6px',
                  cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(0,229,255,0.15)`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = GH.crystalFace; }}
              >
                <div style={{ fontSize: 8, fontFamily: 'monospace', color: GH.cyanBright, letterSpacing: 1, marginBottom: 3 }}>
                  {def.name}
                </div>
                <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.boneDim, lineHeight: 1.3 }}>
                  {tier === 2 ? def.t2description : def.description}
                </div>
              </button>
            );
          })}
        </div>
        <button
          onClick={onSkip}
          style={{
            marginTop: 7, width: '100%', background: 'transparent',
            border: `1px solid ${GH.goldDim}`, borderRadius: 4,
            color: GH.boneDim, fontSize: 7, fontFamily: 'monospace',
            cursor: 'pointer', padding: '4px 0', letterSpacing: 1,
          }}
        >
          KEEP CURRENT
        </button>
      </div>
    </div>
  );
}

// ── RuleShardChip — Abstract shard holder/activator (Feature G) ───────────────
// Shown in the bottom-right corner when a shard is held or active.

function RuleShardChip({
  held, active, expiresAt, onActivate,
}: {
  held: ShardId | null;
  active: ShardId | null;
  expiresAt: number | null;
  onActivate: () => void;
}) {
  const [msLeft, setMsLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setMsLeft(Math.max(0, expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!held && !active) return null;
  const id = active ?? held;
  const def = id ? SHARD_MAP.get(id) : null;
  if (!def) return null;

  const isHeld   = !!held && !active;
  const secsLeft = Math.ceil(msLeft / 1000);

  return (
    <div
      onClick={isHeld ? onActivate : undefined}
      style={{
        position: 'absolute', bottom: 200, right: 8,
        background: GH.panelBg,
        border: `1px solid ${isHeld ? GH.amberHot : GH.cyan}`,
        borderRadius: 6, padding: '6px 10px', cursor: isHeld ? 'pointer' : 'default',
        pointerEvents: 'auto', zIndex: 30, minWidth: 90, textAlign: 'center',
        animation: isHeld ? 'shard-pulse 1.4s ease-in-out infinite' : 'none',
        boxShadow: isHeld ? `0 0 10px ${GH.amberGlow}` : `0 0 6px ${GH.cyanGlow}`,
      }}
    >
      <div style={{ fontSize: 7, fontFamily: 'monospace', letterSpacing: 2, color: isHeld ? GH.amberHot : GH.cyan }}>
        {isHeld ? '▲ SHARD' : '◈ ACTIVE'}
      </div>
      <div style={{ fontSize: 9, fontFamily: 'monospace', color: GH.bone, marginTop: 2 }}>
        {def.name}
      </div>
      {active && expiresAt && (
        <div style={{ fontSize: 7, fontFamily: 'monospace', color: GH.boneDim, marginTop: 1 }}>
          {secsLeft}s
        </div>
      )}
      {isHeld && (
        <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.boneDim, marginTop: 2, lineHeight: 1.3 }}>
          {def.description}
        </div>
      )}
    </div>
  );
}

// ── SlipstreamIndicator — Racing position badge (Feature A) ──────────────────
// VS and Heist only. Shows player rank and window multiplier.

function SlipstreamIndicator({
  position, totalPlayers, windowFactor,
}: {
  position: number | null;
  totalPlayers: number;
  windowFactor: number | null;
}) {
  if (position === null || windowFactor === null || totalPlayers <= 1) return null;

  const isLeader  = position === 1;
  const isTrailer = position === totalPlayers;
  const color = isLeader ? GH.gold : isTrailer ? GH.cyan : GH.magenta;
  const label = isLeader ? '▲ LEAD' : isTrailer ? '▼ SLIP' : `P${position}`;

  return (
    <div style={{
      position: 'absolute', top: 56, right: 8,
      background: GH.panelBg, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '3px 7px',
      pointerEvents: 'none', zIndex: 20,
    }}>
      <div style={{ fontSize: 7, fontFamily: 'monospace', color, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 6, fontFamily: 'monospace', color: GH.boneDim, letterSpacing: 0 }}>
        ×{windowFactor.toFixed(2)} WIN
      </div>
    </div>
  );
}

interface FarkleHUDProps {
  onBank: () => void;
  onBack: () => void;
  onPass?: () => void;
  onDisrupt?: (type: DisruptionType) => void;
  onRainmakerSelect?: (face: number) => void;
  onInitiateHeist?: () => void;
  onBlockHeist?: () => void;
  onRallyBank?: () => void;
  onRallyPass?: () => void;
  onRallyContinue?: () => void;
  gameMode?: GameMode;
  // H/A/I/G — genre props
  draftOptions?: FacetId[];
  draftTier?: 1 | 2;
  onPickFacet?: (id: FacetId) => void;
  onSkipDraft?: () => void;
  shardHeld?: ShardId | null;
  shardActive?: ShardId | null;
  shardExpiresAt?: number | null;
  onActivateShard?: () => void;
  slipstreamPosition?: number | null;
  slipstreamTotalPlayers?: number;
  slipstreamWindowFactor?: number | null;
}

export function FarkleHUD({
  onBank, onBack, onPass, onDisrupt, onRainmakerSelect,
  onInitiateHeist, onBlockHeist,
  onRallyBank, onRallyPass, onRallyContinue,
  gameMode,
  draftOptions, draftTier, onPickFacet, onSkipDraft,
  shardHeld, shardActive, shardExpiresAt, onActivateShard,
  slipstreamPosition, slipstreamTotalPlayers, slipstreamWindowFactor,
}: FarkleHUDProps) {
  const [diceClass, setDiceClass] = useState<DiceClass>('rogue');
  const showDisruptions = onDisrupt && gameMode && DISRUPTION_MODES.has(gameMode);
  const isHeist = gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO';
  const isRally = gameMode === 'RALLY_FREE' || gameMode === 'RALLY_CASINO';
  const hasTimer = useFarkleStore(s => s.timeRemaining !== null);
  const showDraft = (draftOptions?.length ?? 0) > 0 && onPickFacet && onSkipDraft;
  const showShard = (shardHeld != null || shardActive != null) && onActivateShard;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{_GLOBAL_STYLES}</style>
      {/* ── Top chrome ── */}
      <TrickMeter />
      <NeonOscilloscope />

      {/* ── Mid-field overlays ── */}
      <ScoreDisplay />
      <ShardTracker />
      {!hasTimer && <ClassSelector selected={diceClass} onSelect={setDiceClass} />}
      {hasTimer && <TimerDisplay />}
      <RoleBadge />
      <BankButton onBank={onBank} onBack={onBack} {...(onPass ? { onPass } : {})} />
      <HiddenPocket />
      <ChainPreview />

      {/* ── Faucet Economy HUD ── */}
      <VitalityDripPanel />
      <ShardFaucetPanel />

      {/* ── Disruption overlays ── */}
      <DisruptionToast />
      {showDisruptions && <DisruptionPanel onDisrupt={onDisrupt} gameMode={gameMode} />}

      {/* ── Mode-specific panels ── */}
      {onRainmakerSelect && <RainmakerFacePicker onSelect={onRainmakerSelect} />}
      {isHeist && onInitiateHeist && onBlockHeist && (
        <HeistPanel onInitiate={onInitiateHeist} onBlock={onBlockHeist} />
      )}
      {isRally && onRallyBank && onRallyPass && onRallyContinue && (
        <RallyDecisionPanel onRallyBank={onRallyBank} onRallyPass={onRallyPass} onRallyContinue={onRallyContinue} />
      )}

      {/* ── Genre overlays (H/A/I/G) ── */}
      {slipstreamPosition != null && (
        <SlipstreamIndicator
          position={slipstreamPosition}
          totalPlayers={slipstreamTotalPlayers ?? 2}
          windowFactor={slipstreamWindowFactor ?? null}
        />
      )}
      {showShard && (
        <RuleShardChip
          held={shardHeld ?? null}
          active={shardActive ?? null}
          expiresAt={shardExpiresAt ?? null}
          onActivate={onActivateShard!}
        />
      )}
      {showDraft && (
        <DraftPanel
          options={draftOptions!}
          tier={draftTier ?? 1}
          onPick={onPickFacet!}
          onSkip={onSkipDraft!}
        />
      )}

      {/* ── Transient effects ── */}
      <HorrorHeartbeat />
      <FrenzyInstabilityWarning />
      <FarkleFlash />
      <ModePulse />
      <ScorePopupLayer />
    </div>
  );
}

// ── Beat Window (exported for GameScreen layout) ──────────────────────────────
export { BeatWindow };

// ── Void Resonance Layer (Feature F) ─────────────────────────────────────────
// Cosmetic-only overlay that activates when energy hits MAX (300).
// Visual layers:
//   1. Gothic lattice veil — semi-transparent cathedral geometry over the game canvas
//   2. Discharge burst — 5 concentric expanding rings + 7 rising gold sparks
//      Fires when energy naturally drops from MAX (FRENZY drain, ~200 ms after peak)
// No Sacred Core files or game logic are touched — pure CSS/React presentation.

const VOID_LATTICE_BG = `
  repeating-linear-gradient(0deg,   transparent 0, transparent 39px, rgba(0,229,255,0.055) 40px),
  repeating-linear-gradient(60deg,  transparent 0, transparent 39px, rgba(0,229,255,0.055) 40px),
  repeating-linear-gradient(120deg, transparent 0, transparent 39px, rgba(0,229,255,0.055) 40px)
`.trim();

export function VoidResonanceLayer() {
  const energy = useFarkleStore(s => s.energy);
  const [isResonant, setIsResonant] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const prevEnergyRef = useRef(energy);
  const isResonantRef = useRef(false);

  useEffect(() => {
    const prev = prevEnergyRef.current;
    prevEnergyRef.current = energy;

    // Transition IN: energy reaches MAX
    if (!isResonantRef.current && energy >= MAX_ENERGY) {
      isResonantRef.current = true;
      setIsResonant(true);
    }

    // Transition OUT: energy drops below MAX (natural FRENZY drain) → discharge
    if (isResonantRef.current && prev >= MAX_ENERGY && energy < MAX_ENERGY) {
      isResonantRef.current = false;
      setIsResonant(false);
      setDischarging(true);
      setMusicState('euphoric');
      const t = setTimeout(() => setDischarging(false), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [energy]);

  if (!isResonant && !discharging) return null;

  return (
    <>
      {/* Lattice Veil */}
      {isResonant && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
          background: VOID_LATTICE_BG,
          animation: 'void-veil-in 0.6s ease forwards',
        }} />
      )}
      {!isResonant && discharging && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
          background: VOID_LATTICE_BG,
          animation: 'void-veil-out 0.4s ease forwards',
        }} />
      )}

      {/* Discharge burst — concentric rings */}
      {discharging && [0, 40, 80, 130, 190].map((delayMs, i) => (
        <div key={i} style={{
          position: 'absolute', left: '50%', top: '45%',
          width: `${60 + i * 25}vmin`, height: `${60 + i * 25}vmin`,
          borderRadius: '50%',
          border: `${i === 0 ? 2 : 1}px solid ${i % 2 === 0 ? GH.cyan : GH.gold}`,
          boxShadow: `0 0 ${8 + i * 3}px ${i % 2 === 0 ? GH.cyanGlow : GH.goldGlow}`,
          transform: 'translate(-50%, -50%) scale(0)',
          pointerEvents: 'none', zIndex: 9,
          animationName: 'void-ring-expand',
          animationDuration: '550ms',
          animationDelay: `${delayMs}ms`,
          animationTimingFunction: 'cubic-bezier(0.2, 0, 0.8, 1)',
          animationFillMode: 'forwards',
        }} />
      ))}

      {/* Discharge burst — column sparks */}
      {discharging && [8, 21, 34, 50, 66, 79, 92].map((leftPct, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${leftPct}%`,
          bottom: '10%',
          color: i % 2 === 0 ? GH.gold : GH.cyan,
          fontSize: 10,
          fontFamily: 'monospace',
          pointerEvents: 'none', zIndex: 9,
          animationName: 'void-spark-rise',
          animationDuration: `${420 + i * 30}ms`,
          animationDelay: `${i * 25}ms`,
          animationTimingFunction: 'ease-out',
          animationFillMode: 'forwards',
        }}>◆</div>
      ))}
    </>
  );
}
