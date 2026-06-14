// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────
// ORPHANED — confirmed no imports across apps/web/src (UI audit 2026-05-31).
// GameHUD reads useGameStore (match-3 model), not useFarkleStore (dice model).
// Pending deletion in a dedicated cleanup PR — do not extend.

import React, { useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import type { TraySlot, ObjectiveState } from '@match3d/game-core';

// ─── Timer Bar ────────────────────────────────────────────────────────────────

function TimerBar() {
  const { timeRemaining, currentLevel } = useGameStore(s => ({
    timeRemaining: s.timeRemaining,
    currentLevel: s.currentLevel,
  }));
  const total = currentLevel?.timerSeconds ?? 120;
  const pct = Math.max(0, (timeRemaining / total) * 100);
  const urgent = timeRemaining < 15;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 6, background: '#0d2040',
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: urgent ? '#ff4444' : '#3af',
        transition: 'width 0.25s linear, background 0.3s',
        boxShadow: urgent ? '0 0 8px #ff4444' : '0 0 4px #3af',
      }} />
    </div>
  );
}

// ─── Score + Combo ─────────────────────────────────────────────────────────────

function ScoreDisplay() {
  const { score, comboCount } = useGameStore(s => ({ score: s.score, comboCount: s.comboCount }));
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
      textAlign: 'center', pointerEvents: 'none',
    }}>
      <div style={{ color: '#7ecfff', fontSize: 24, fontWeight: 700, fontFamily: 'monospace',
        textShadow: '0 0 8px #3af' }}>
        {score.toLocaleString()}
      </div>
      {comboCount > 1 && (
        <div style={{ color: '#d4a0ff', fontSize: 14, fontWeight: 600,
          textShadow: '0 0 6px #8040ff', animation: 'pulse 0.5s ease-in-out' }}>
          ×{comboCount} COMBO
        </div>
      )}
    </div>
  );
}

// ─── Tray ────────────────────────────────────────────────────────────────────

const CATEGORY_BORDER: Record<string, string> = {
  structural: '#7ecfff',
  organic: '#5de58a',
  hybrid: '#d4a0ff',
};

function TrayDisplay() {
  const traySlots = useGameStore(s => s.traySlots);

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, padding: '10px 16px',
      background: 'rgba(10,22,40,0.85)', borderRadius: 12,
      border: '1px solid #1a4060',
      backdropFilter: 'blur(8px)',
    }}>
      {traySlots.map((slot, i) => (
        <TraySlotView key={i} slot={slot} />
      ))}
    </div>
  );
}

function TraySlotView({ slot }: { slot: TraySlot }) {
  const filled = slot.item !== null;
  const category = slot.item?.category;
  const border = category ? CATEGORY_BORDER[category] : '#1a4060';

  return (
    <div style={{
      width: 44, height: 44, borderRadius: 8,
      border: `2px solid ${border}`,
      background: filled ? 'rgba(30,60,100,0.8)' : 'rgba(10,22,40,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease',
      boxShadow: filled ? `0 0 6px ${border}40` : 'none',
    }}>
      {filled && (
        <div style={{
          width: 20, height: 20, borderRadius: category === 'organic' ? '50%' : category === 'structural' ? 4 : 10,
          background: border,
          boxShadow: `0 0 4px ${border}`,
        }} />
      )}
    </div>
  );
}

// ─── Objectives ───────────────────────────────────────────────────────────────

function ObjectivesPanel() {
  const objectives = useGameStore(s => s.objectives);

  return (
    <div style={{
      position: 'absolute', top: 20, right: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
      maxWidth: 180,
    }}>
      {objectives.map((obj) => (
        <ObjectiveRow key={obj.config.id} state={obj} />
      ))}
    </div>
  );
}

function ObjectiveRow({ state }: { state: ObjectiveState }) {
  const pct = Math.min(100, (state.current / state.config.target) * 100);
  return (
    <div style={{
      background: 'rgba(10,22,40,0.85)', borderRadius: 8,
      padding: '6px 10px', border: `1px solid ${state.completed ? '#5de58a' : '#1a4060'}`,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{ color: state.completed ? '#5de58a' : '#7ecfff', fontSize: 11, fontFamily: 'monospace' }}>
        {state.config.label}
      </div>
      <div style={{ marginTop: 4, height: 3, background: '#0d2040', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: state.completed ? '#5de58a' : '#3af',
          borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ color: '#7090a0', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>
        {Math.min(state.current, state.config.target)} / {state.config.target}
      </div>
    </div>
  );
}

// ─── Currency Display ─────────────────────────────────────────────────────────

function CurrencyDisplay() {
  const { goldCoins, sweepsCoins } = useGameStore(s => ({
    goldCoins: s.economyBalance.goldCoins,
    sweepsCoins: s.economyBalance.sweepsCoins,
  }));
  return (
    <div style={{
      position: 'absolute', top: 20, left: 12,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        background: 'rgba(10,22,40,0.85)', borderRadius: 8,
        padding: '4px 10px', border: '1px solid #4a3a00',
        color: '#ffd700', fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
      }}>
        🟡 {goldCoins.toLocaleString()}
      </div>
      <div style={{
        background: 'rgba(10,22,40,0.85)', borderRadius: 8,
        padding: '4px 10px', border: '1px solid #003a4a',
        color: '#00e5ff', fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
      }}>
        💎 {sweepsCoins.toLocaleString()} SC
      </div>
    </div>
  );
}

// ─── Main HUD ─────────────────────────────────────────────────────────────────

export function GameHUD() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <TimerBar />
      <ScoreDisplay />
      <CurrencyDisplay />
      <ObjectivesPanel />
      <TrayDisplay />
    </div>
  );
}
