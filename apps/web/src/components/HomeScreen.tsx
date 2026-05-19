// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { QuestPanel } from './QuestPanel.js';
import { EventBanner } from './EventBanner.js';
import { LEVELS } from '../data/levels.js';

// Gothic Hacker Neon palette — matches FarkleHUD, WinLoseScreen, GameScreen
// Colors sourced from dream/shared/source-of-truth/organic-vegas/design_tokens.json
const GH = {
  void:        '#050008',
  neural:      '#0d0018',
  bone:        '#e8d5a3',
  boneDim:     'rgba(232,213,163,0.45)',
  boneFaint:   'rgba(232,213,163,0.18)',
  gold:        '#c9a84c',
  goldBright:  '#f0c860',
  goldGlow:    'rgba(201,168,76,0.55)',
  goldDim:     'rgba(201,168,76,0.22)',
  acidLime:    '#c8d400',
  limeDim:     'rgba(200,212,0,0.25)',
  cyan:        '#00e5ff',
  cyanGlow:    'rgba(0,229,255,0.45)',
  cyanDim:     'rgba(0,229,255,0.15)',
  magenta:     '#ff00cc',
  magentaDim:  'rgba(255,0,204,0.15)',
  panelBg:     'rgba(5,0,18,0.92)',
  panelBorder: 'rgba(201,168,76,0.42)',
  cardBg:      'rgba(13,0,24,0.85)',
  cardBorder:  'rgba(0,229,255,0.18)',
  danger:      '#ef4444',
} as const;

// CRT scanline overlay — shared motif across all screens
const CRT: React.CSSProperties = {
  position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
  background: `
    repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px),
    radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)
  `,
};

// Gothic filigree corner marks
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

export function HomeScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const setGameMode = useGameStore(s => s.setGameMode);
  const resources = useGameStore(s => s.resources);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const setSelectedLevelId = useGameStore(s => s.setSelectedLevelId);
  const [showLevels, setShowLevels] = useState(false);

  const selectedLevel = LEVELS.find(l => l.id === selectedLevelId) ?? LEVELS[0]!;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: GH.void,
      color: GH.bone, fontFamily: 'monospace', padding: '20px 20px 32px',
      position: 'relative', overflowX: 'hidden',
    }}>
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
          filter: 'drop-shadow(0 0 12px rgba(200,212,0,0.4))',
        }}>
          FARKLE FRENZY
        </h1>
        <p style={{
          color: GH.boneDim, fontSize: 10, margin: '4px 0 0',
          letterSpacing: 3, textTransform: 'uppercase',
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
        <ResourceBadge label="Steel"  value={resources.bioSteel}   color={GH.cyan}     />
        <ResourceBadge label="Seeds"  value={resources.aeroSeeds}  color={GH.acidLime} />
        <ResourceBadge label="Gold"   value={resources.goldCoins}  color={GH.gold}     />
        <ResourceBadge label="SC"     value={resources.sweepsCoins} color={GH.magenta}  />
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
              fontSize: 16, fontWeight: 900, cursor: 'pointer', fontFamily: 'monospace',
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
              fontSize: 11, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
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
                    fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
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
      <div style={{ color, fontSize: 14, fontWeight: 700, textShadow: `0 0 8px ${color}` }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, marginTop: 1 }}>
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
        fontFamily: 'monospace', textAlign: 'left', letterSpacing: 1,
        boxShadow: `inset 0 0 0 0 transparent`,
        borderLeft: `3px solid ${accent}`,
        transition: 'opacity 0.1s ease',
      }}
    >
      {label}
    </button>
  );
}
