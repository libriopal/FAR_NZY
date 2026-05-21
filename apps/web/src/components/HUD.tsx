// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React from 'react';
import { useGameStore } from '../store/gameStore.js';
import type { TraySlot, ObjectiveState } from '@match3d/game-core';
import { OV, CURRENCY, TYPE, PILLAR } from '../theme/tokens.js';

// ─── Timer Bar — reality law: urgent → magenta (physical), safe → cyan (virtual) ─

function TimerBar() {
  const { timeRemaining, currentLevel } = useGameStore(s => ({
    timeRemaining: s.timeRemaining,
    currentLevel: s.currentLevel,
  }));
  const total = currentLevel?.timerSeconds ?? 120;
  const pct    = Math.max(0, (timeRemaining / total) * 100);
  const urgent = timeRemaining < 15;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 6, background: OV.neural,
    }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: urgent ? OV.magenta : OV.cyan,
        transition: 'width 0.25s linear, background 0.3s',
        boxShadow: urgent ? `0 0 8px ${OV.magenta}` : `0 0 4px ${OV.cyan}`,
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
      <div style={{
        color: OV.cyanBright, fontSize: TYPE.scale.hudNumeric.size,
        fontWeight: TYPE.scale.hudNumeric.weight, fontFamily: TYPE.fontCode,
        textShadow: `0 0 10px ${OV.cyan}`,
      }}>
        {score.toLocaleString()}
      </div>
      {comboCount > 1 && (
        <div style={{
          color: OV.magentaBright, fontSize: 14, fontWeight: 600,
          fontFamily: TYPE.fontCode,
          textShadow: `0 0 6px ${OV.magenta}`,
        }}>
          ×{comboCount} COMBO
        </div>
      )}
    </div>
  );
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  structural: OV.cyan,
  organic:    PILLAR.BIOLOGICAL.highlight,
  hybrid:     OV.magentaBright,
};

function TrayDisplay() {
  const traySlots = useGameStore(s => s.traySlots);
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, padding: '10px 16px',
      background: `rgba(13,0,24,0.88)`,
      borderRadius: 12,
      border: `1px solid ${OV.goldDim}`,
      backdropFilter: 'blur(8px)',
    }}>
      {traySlots.map((slot, i) => (
        <TraySlotView key={i} slot={slot} />
      ))}
    </div>
  );
}

function TraySlotView({ slot }: { slot: TraySlot }) {
  const filled   = slot.item !== null;
  const category = slot.item?.category;
  const color    = category ? (CATEGORY_COLOR[category] ?? OV.goldDim) : OV.goldDim;

  return (
    <div style={{
      width: 44, height: 44, borderRadius: 8,
      border: `2px solid ${filled ? color : OV.goldDim}`,
      background: filled ? `rgba(13,0,24,0.8)` : `rgba(5,0,8,0.4)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s ease',
      boxShadow: filled ? `0 0 6px ${color}40` : 'none',
    }}>
      {filled && (
        <div style={{
          width: 20, height: 20,
          borderRadius: category === 'organic' ? '50%' : category === 'structural' ? 4 : 10,
          background: color,
          boxShadow: `0 0 4px ${color}`,
        }} />
      )}
    </div>
  );
}

// ─── Objectives ────────────────────────────────────────────────────────────────

function ObjectivesPanel() {
  const objectives = useGameStore(s => s.objectives);
  return (
    <div style={{
      position: 'absolute', top: 20, right: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
      maxWidth: 180,
    }}>
      {objectives.map(obj => (
        <ObjectiveRow key={obj.config.id} state={obj} />
      ))}
    </div>
  );
}

function ObjectiveRow({ state }: { state: ObjectiveState }) {
  const pct       = Math.min(100, (state.current / state.config.target) * 100);
  const doneColor = OV.goldBright;   // gold for completed — physical-reality reward
  const fillColor = state.completed ? doneColor : OV.cyan;
  return (
    <div style={{
      background: `rgba(13,0,24,0.88)`, borderRadius: 8,
      padding: '6px 10px',
      border: `1px solid ${state.completed ? OV.goldDim : OV.cyanGlow}`,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        color: state.completed ? doneColor : OV.cyanBright,
        fontSize: 11, fontFamily: TYPE.fontCode,
      }}>
        {state.config.label}
      </div>
      <div style={{ marginTop: 4, height: 3, background: OV.neural, borderRadius: 2 }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: fillColor,
          borderRadius: 2, transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ color: OV.boneDim, fontSize: 10, marginTop: 2, fontFamily: TYPE.fontCode }}>
        {Math.min(state.current, state.config.target)} / {state.config.target}
      </div>
    </div>
  );
}

// ─── Currency Display — FAR_NZY names, no legacy GC/SC ────────────────────────
// Reads legacy store properties but displays correct FAR_NZY labels.

function CurrencyDisplay() {
  const { goldCoins, sweepsCoins } = useGameStore(s => ({
    goldCoins:   s.economyBalance.goldCoins,
    sweepsCoins: s.economyBalance.sweepsCoins,
  }));
  return (
    <div style={{
      position: 'absolute', top: 20, left: 12,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{
        background: `rgba(13,0,24,0.88)`, borderRadius: 8,
        padding: '4px 10px', border: `1px solid ${OV.goldDim}`,
        color: OV.goldBright, fontSize: 13,
        fontFamily: TYPE.fontCode, fontWeight: 700,
        textShadow: `0 0 6px ${OV.goldGlow}`,
      }}>
        {CURRENCY.fd.symbol} {goldCoins.toLocaleString()}
      </div>
      <div style={{
        background: `rgba(13,0,24,0.88)`, borderRadius: 8,
        padding: '4px 10px', border: `1px solid ${OV.cyanGlow}`,
        color: OV.cyanBright, fontSize: 13,
        fontFamily: TYPE.fontCode, fontWeight: 700,
        textShadow: `0 0 6px ${OV.cyan}`,
      }}>
        {CURRENCY.pdx.symbol} {sweepsCoins.toLocaleString()}
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
