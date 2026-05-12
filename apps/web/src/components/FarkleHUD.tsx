// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { useFarkleStore, MULTIPLIER_LADDER, MAX_ENERGY, FRENZY_THRESHOLD, FRENZY_INSTABILITY_THRESHOLD } from '../store/farkleStore.js';
import { WIN_SCORE } from '../hooks/useFarkleGame.js';
import type { DisruptionType, GameMode } from '@match3d/farkle-shared';
import { HEIST_CONSTANTS } from '@match3d/farkle-shared';

const FACE_COLOR: Record<number, string> = {
  1: '#f43f5e', 2: '#f97316', 3: '#fbbf24',
  4: '#10b981', 5: '#38bdf8', 6: '#7c3aed',
};

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
          setPopups(p => [...p, { id, text: `+${delta.toLocaleString()}`, color: 'var(--ba-glow-amber)' }]);
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
          fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
          textShadow: `0 0 8px ${p.color}`,
          animation: 'floatUp 1.2s ease-out forwards',
          whiteSpace: 'nowrap',
        }}>
          {p.text}
        </div>
      ))}
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
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
      setTimeout(() => setVisible(false), 600);
    }
  }, [farkleCount]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: 'rgba(200,0,0,0.25)',
      animation: 'farkleFlash 0.6s ease-out forwards',
    }}>
      <div style={{
        position: 'absolute', top: '42%', left: '50%', transform: 'translateX(-50%)',
        color: 'var(--ba-danger)', fontSize: 32, fontWeight: 900, fontFamily: 'monospace',
        textShadow: '0 0 16px var(--ba-danger)', letterSpacing: 4,
      }}>
        FARKLE!
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
      if (mode === 'FRENZY') setPulse({ color: 'var(--ba-frenzy)', label: 'FRENZY!' });
      else if (mode === 'PRIME') setPulse({ color: 'var(--ba-blueprint)', label: 'PRIME' });
      else setPulse({ color: 'var(--ba-marble-500)', label: 'NORMAL' });
      setTimeout(() => setPulse(null), 800);
    }
  }, [mode]);

  if (!pulse) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        color: pulse.color, fontSize: 28, fontWeight: 900,
        fontFamily: 'monospace', textShadow: `0 0 20px ${pulse.color}`,
        animation: 'modePulse 0.8s ease-out forwards',
        letterSpacing: 6,
      }}>
        {pulse.label}
      </div>
      <style>{`
        @keyframes modePulse {
          0%   { opacity: 0; transform: scale(0.7); }
          30%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ── Energy Bar ────────────────────────────────────────────────────────────────

function EnergyBar() {
  const { energy, mode } = useFarkleStore(s => ({ energy: s.energy, mode: s.mode }));
  const pct = (energy / MAX_ENERGY) * 100;

  const barBg =
    mode === 'FRENZY' ? 'linear-gradient(90deg, var(--ba-vine-mid), var(--ba-glow-teal))' :
    mode === 'PRIME'  ? 'linear-gradient(90deg, var(--ba-vine-dark), var(--ba-glow-green))' :
    'var(--ba-marble-800)';

  const label = mode === 'FRENZY' ? 'FRENZY' : mode === 'PRIME' ? 'PRIME' : 'NORMAL';
  const labelColor =
    mode === 'FRENZY' ? 'var(--ba-frenzy)' :
    mode === 'PRIME'  ? 'var(--ba-blueprint)' :
    'var(--ba-marble-500)';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 44,
      background: 'var(--ba-glass-bg)',
      backdropFilter: 'var(--ba-glass-blur)',
      WebkitBackdropFilter: 'var(--ba-glass-blur)',
      borderBottom: '1px solid var(--ba-glass-border)',
      display: 'flex', alignItems: 'center', paddingLeft: 10, paddingRight: 10, gap: 8,
    }}>
      <span style={{ color: labelColor, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 52 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, background: 'var(--ba-marble-950)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: `${(FRENZY_THRESHOLD / MAX_ENERGY) * 100}%`,
          top: 0, bottom: 0, width: 1, background: 'rgba(34,211,238,0.4)',
        }} />
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barBg,
          transition: 'width 0.1s linear',
          borderRadius: 4,
          ...(mode === 'FRENZY' ? { boxShadow: '0 0 8px var(--ba-glow-teal)' } :
             mode === 'PRIME'  ? { boxShadow: '0 0 6px var(--ba-glow-green)' } : {}),
        }} />
      </div>
      <span style={{ color: 'var(--ba-marble-500)', fontSize: 10, fontFamily: 'monospace', minWidth: 32, textAlign: 'right' }}>
        {Math.floor(energy)}/{MAX_ENERGY}
      </span>
    </div>
  );
}

// ── Score Display ─────────────────────────────────────────────────────────────

function ScoreDisplay() {
  const { banked, unbanked, multiplierStep } = useFarkleStore(s => ({
    banked: s.banked, unbanked: s.unbanked, multiplierStep: s.multiplierStep,
  }));

  const total = banked + unbanked;
  const mult = MULTIPLIER_LADDER[Math.min(multiplierStep, 5)] ?? 1;
  const progressPct = Math.min(100, (total / WIN_SCORE) * 100);

  return (
    <div style={{
      position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
      textAlign: 'center', pointerEvents: 'none',
    }}>
      <div style={{ color: 'var(--ba-accent)', fontSize: 22, fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 8px var(--ba-accent-glow)' }}>
        {total.toLocaleString()}
      </div>
      <div style={{ width: 120, height: 3, background: 'var(--ba-marble-950)', borderRadius: 2, margin: '3px auto 0' }}>
        <div style={{
          height: '100%', width: `${progressPct}%`,
          background: 'var(--ba-glow-amber)', borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 9, fontFamily: 'monospace' }}>
        {total.toLocaleString()} / {WIN_SCORE.toLocaleString()}
      </div>
      {mult > 1 && (
        <div style={{ color: 'var(--ba-blueprint)', fontSize: 12, fontFamily: 'monospace' }}>×{mult} multiplier</div>
      )}
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
      position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {chainFaces.map((face, i) => (
          <div key={i} style={{
            width: 32, height: 32, borderRadius: 6,
            background: FACE_COLOR[face] ?? 'var(--ba-blueprint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
            boxShadow: `0 0 8px ${FACE_COLOR[face] ?? 'var(--ba-blueprint-glow)'}`,
          }}>
            {face}
          </div>
        ))}
      </div>
      <div style={{
        color: isFarkle ? 'var(--ba-danger)' : 'var(--ba-glow-amber)',
        fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
      }}>
        {isFarkle ? 'FARKLE' : `+${preview.toLocaleString()}`}
      </div>
    </div>
  );
}

// ── Bank Button ───────────────────────────────────────────────────────────────

function BankButton({ onBank, onBack, onPass }: { onBank: () => void; onBack: () => void; onPass?: () => void }) {
  const { unbanked, rallyRole } = useFarkleStore(s => ({ unbanked: s.unbanked, rallyRole: s.rallyRole }));

  return (
    <div style={{ position: 'absolute', top: 50, right: 12, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'auto' }}>
      {unbanked > 0 && (
        <button onClick={onBank} style={{
          background: 'var(--ba-accent)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px',
          fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
          boxShadow: '0 0 12px var(--ba-accent-glow)',
        }}>
          BANK {unbanked.toLocaleString()}
        </button>
      )}
      {onPass && unbanked > 0 && (
        <button onClick={onPass} style={{
          background: rallyRole === 'CONDUCTOR' ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${rallyRole === 'CONDUCTOR' ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.15)'}`,
          color: rallyRole === 'CONDUCTOR' ? '#818cf8' : 'var(--ba-marble-400)',
          borderRadius: 8, padding: '4px 10px',
          fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
        }}>
          PASS{rallyRole === 'CONDUCTOR' ? ' +STEP' : ''}
        </button>
      )}
      <button onClick={onBack} style={{
        background: 'var(--ba-card-bg)', border: '1px solid var(--ba-card-border)',
        color: 'var(--ba-marble-500)',
        borderRadius: 8, padding: '4px 10px',
        fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
      }}>
        ← Exit
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
      position: 'absolute', top: 50, left: 12,
      color: isLow ? 'var(--ba-danger)' : 'var(--ba-marble-200)',
      fontSize: isLow ? 17 : 14, fontFamily: 'monospace', fontWeight: 700,
      textShadow: isLow ? '0 0 10px var(--ba-danger)' : 'none',
      pointerEvents: 'none',
      animation: isLow && secs % 2 === 0 ? 'timerPulse 1s ease infinite' : 'none',
    }}>
      {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
      <style>{`@keyframes timerPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  RAINMAKER: '#fbbf24', HEADHUNTER: '#ef4444',
  ARCHIVIST: '#10b981', CONDUCTOR: '#7c3aed',
};

function RoleBadge() {
  const rallyRole = useFarkleStore(s => s.rallyRole);
  if (!rallyRole) return null;
  const c = ROLE_COLORS[rallyRole] ?? '#fff';
  return (
    <div style={{
      position: 'absolute', top: 72, left: 12,
      color: c, fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
      letterSpacing: 1, pointerEvents: 'none',
      textShadow: `0 0 6px ${c}`,
    }}>
      ◈ {rallyRole}
    </div>
  );
}

// ── Disruption Panel (VS / Heist modes only) ─────────────────────────────────

const DISRUPTION_DEFS: { type: DisruptionType; label: string; emoji: string }[] = [
  { type: 'ice_send',  label: 'ICE',     emoji: '❄️' },
  { type: 'lock_send', label: 'LOCK',    emoji: '🔒' },
  { type: 'scramble',  label: 'SCRAMBLE',emoji: '🌀' },
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
    // HEIST: free disrupts while in FRENZY
    if (isHeist && isFrenzy) { onDisrupt(type); return; }
    if (disruptCharges <= 0) return;
    if (!spendDisruptCharge()) return;
    onDisrupt(type);
  }

  const hasCharge = disruptCharges > 0 || (isHeist && isFrenzy);

  return (
    <div style={{
      position: 'absolute', bottom: 80, right: 12,
      display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'auto',
      alignItems: 'flex-end',
    }}>
      {/* Mode badge */}
      <div style={{
        fontSize: 9, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
        color: 'rgba(167,139,250,0.7)', marginBottom: 2,
      }}>
        {MODE_LABEL[gameMode]} MODE
      </div>

      {/* Charge meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%',
            background: i < disruptCharges
              ? '#a78bfa'
              : i === disruptCharges
                ? `linear-gradient(90deg, #a78bfa ${disruptChargeProgress}%, rgba(124,58,237,0.2) ${disruptChargeProgress}%)`
                : 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.4)',
            boxShadow: i < disruptCharges ? '0 0 5px rgba(167,139,250,0.7)' : 'none',
            transition: 'background 0.1s',
          }} />
        ))}
        <span style={{
          fontSize: 9,
          color: isHeist && isFrenzy ? '#22c55e' : isFrenzy ? '#a78bfa' : 'var(--ba-marble-800)',
          fontFamily: 'monospace',
        }}>
          {isHeist ? (isFrenzy ? '🔥 FREE NOW' : 'FREE IN FRENZY') : (isFrenzy ? 'CHARGING' : 'FRENZY TO CHARGE')}
        </span>
      </div>

      {/* Disruption buttons */}
      {DISRUPTION_DEFS.map(({ type, label, emoji }) => (
        <button key={type} onClick={() => fireDisrupt(type)} disabled={!hasCharge} style={{
          background: hasCharge ? 'rgba(124,58,237,0.35)' : 'var(--ba-card-bg)',
          border: `1px solid ${hasCharge ? 'rgba(167,139,250,0.7)' : 'var(--ba-card-border)'}`,
          color: hasCharge ? '#e9d5ff' : 'var(--ba-marble-800)',
          borderRadius: 8, padding: '5px 10px',
          fontSize: 11, fontWeight: 700,
          cursor: hasCharge ? 'pointer' : 'default',
          fontFamily: 'monospace', whiteSpace: 'nowrap',
          boxShadow: hasCharge ? '0 0 8px rgba(124,58,237,0.4)' : 'none',
          transition: 'all 0.15s ease',
        }}>
          {emoji} {label}
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
    ice_send: '❄️ ICE incoming!',
    lock_send: '🔒 LOCK incoming!',
    scramble: '🌀 Scramble incoming!',
  };

  return (
    <div style={{
      position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30,0,60,0.92)', border: '1px solid rgba(200,50,255,0.6)',
      borderRadius: 10, padding: '8px 20px',
      color: '#e879f9', fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
      boxShadow: '0 0 16px rgba(200,50,255,0.4)',
      animation: 'disruptIn 0.3s ease-out',
      pointerEvents: 'auto', zIndex: 10,
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      {labels[pendingDisruption.type] ?? 'Disruption incoming!'}
      <button onClick={dismissDisruption} style={{
        background: 'transparent', border: 'none', color: 'rgba(200,50,255,0.7)',
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

// ── Frenzy Instability Warning (B19) ─────────────────────────────────────────

function FrenzyInstabilityWarning() {
  const { mode, energy } = useFarkleStore(s => ({ mode: s.mode, energy: s.energy }));
  if (mode !== 'FRENZY' || energy >= FRENZY_INSTABILITY_THRESHOLD) return null;
  const critical = energy < 30;
  return (
    <div style={{
      position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 6,
      background: critical ? 'rgba(200,0,0,0.22)' : 'rgba(200,100,0,0.16)',
      border: `1px solid ${critical ? 'rgba(239,68,68,0.7)' : 'rgba(251,146,60,0.55)'}`,
      borderRadius: 8, padding: '4px 12px',
      pointerEvents: 'none',
      animation: 'instabilityPulse 0.9s ease-in-out infinite',
    }}>
      <span style={{ fontSize: 13 }}>⚡</span>
      <span style={{
        color: critical ? '#ef4444' : '#fb923c',
        fontSize: 11, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1,
        textShadow: `0 0 8px ${critical ? '#ef4444' : '#fb923c'}`,
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

// ── RAINMAKER Bomb Face Picker (B7) ──────────────────────────────────────────

interface RainmakerFacePickerProps { onSelect: (face: number) => void; }

function RainmakerFacePicker({ onSelect }: RainmakerFacePickerProps) {
  const pendingId = useFarkleStore(s => s.pendingRainmakerBombId);
  if (!pendingId) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', pointerEvents: 'auto', zIndex: 20,
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid rgba(251,191,36,0.5)', borderRadius: 14,
        padding: '18px 22px', textAlign: 'center',
      }}>
        <div style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 12, letterSpacing: 1, marginBottom: 12 }}>
          RAINMAKER — SELECT TARGET FACE
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6].map(f => (
            <button key={f} onClick={() => onSelect(f)} style={{
              width: 44, height: 44, borderRadius: 8,
              background: FACE_COLOR[f] ?? '#888',
              border: '2px solid rgba(255,255,255,0.2)',
              color: '#fff', fontWeight: 700, fontSize: 18,
              cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main HUD ──────────────────────────────────────────────────────────────────

const DISRUPTION_MODES = new Set<GameMode>(['VS_FREE', 'VS_CASINO', 'HEIST_FREE', 'HEIST_CASINO']);

// C1: Heist vault meter + initiate/block buttons
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
    <div style={{ position: 'absolute', bottom: 120, left: 12, pointerEvents: 'auto', minWidth: 130 }}>
      {/* Vault meter */}
      <div style={{ fontSize: 10, color: '#a78bfa', marginBottom: 4, letterSpacing: 1 }}>VAULT</div>
      <div style={{ background: '#1e1b4b', borderRadius: 4, height: 8, width: 120, overflow: 'hidden', border: '1px solid #4c1d95' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: pct >= 1 ? '#7c3aed' : '#4f46e5', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 9, color: '#7c3aed', marginTop: 2 }}>{vaultPts.toLocaleString()} / {HEIST_CONSTANTS.VAULT_THRESHOLD.toLocaleString()}</div>
      {canInitiate && (
        <button onClick={onInitiate} style={{ marginTop: 6, padding: '4px 8px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          HEIST (−{HEIST_CONSTANTS.HEIST_ENERGY_COST}⚡)
        </button>
      )}
      {heistActive && (
        <button onClick={onBlock} style={{ marginTop: 6, padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', animation: 'pulse 0.5s infinite alternate' }}>
          BLOCK ({countdown}s)
        </button>
      )}
    </div>
  );
}

// C15: Rally Continue/Bank/Pass decision panel with vote tally
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
  const hasOtherVoters = voteEntries.length > 0;

  const voteColor: Record<string, string> = { bank: '#059669', pass: '#7c3aed', continue: '#1d4ed8' };

  function handleVote(choice: 'bank' | 'pass' | 'continue', fn: () => void) {
    if (myVote) return;
    setMyVote(choice);
    fn();
  }

  return (
    <div style={{ position: 'absolute', bottom: '28%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'rgba(10,6,35,0.88)', border: '1px solid #4f46e5', borderRadius: 10, padding: '12px 20px' }}>
      <div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 2 }}>RALLY DECISION — {countdown}s</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => handleVote('bank', onRallyBank)}
          disabled={!!myVote}
          style={{ padding: '6px 14px', background: myVote === 'bank' ? '#059669' : myVote ? '#374151' : '#059669', color: '#fff', border: myVote === 'bank' ? '2px solid #6ee7b7' : '2px solid transparent', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: myVote ? 'default' : 'pointer', opacity: myVote && myVote !== 'bank' ? 0.45 : 1 }}
        >BANK</button>
        <button
          onClick={() => handleVote('pass', onRallyPass)}
          disabled={!!myVote}
          style={{ padding: '6px 14px', background: myVote === 'pass' ? '#7c3aed' : myVote ? '#374151' : '#7c3aed', color: '#fff', border: myVote === 'pass' ? '2px solid #c4b5fd' : '2px solid transparent', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: myVote ? 'default' : 'pointer', opacity: myVote && myVote !== 'pass' ? 0.45 : 1 }}
        >PASS</button>
        <button
          onClick={() => handleVote('continue', onRallyContinue)}
          disabled={!!myVote}
          style={{ padding: '6px 14px', background: myVote === 'continue' ? '#1d4ed8' : myVote ? '#374151' : '#1d4ed8', color: '#fff', border: myVote === 'continue' ? '2px solid #93c5fd' : '2px solid transparent', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: myVote ? 'default' : 'pointer', opacity: myVote && myVote !== 'continue' ? 0.45 : 1 }}
        >CONTINUE</button>
      </div>
      {hasOtherVoters && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {voteEntries.map(([pid, v]) => (
            <div key={pid} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: voteColor[v] ?? '#374151', color: '#fff', letterSpacing: 1, fontWeight: 700 }}>
              {v.toUpperCase()}
            </div>
          ))}
        </div>
      )}
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
}

export function FarkleHUD({ onBank, onBack, onPass, onDisrupt, onRainmakerSelect, onInitiateHeist, onBlockHeist, onRallyBank, onRallyPass, onRallyContinue, gameMode }: FarkleHUDProps) {
  const showDisruptions = onDisrupt && gameMode && DISRUPTION_MODES.has(gameMode);
  const isHeist = gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO';
  const isRally = gameMode === 'RALLY_FREE' || gameMode === 'RALLY_CASINO';
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <EnergyBar />
      <ScoreDisplay />
      <BankButton onBank={onBank} onBack={onBack} {...(onPass ? { onPass } : {})} />
      <TimerDisplay />
      <RoleBadge />
      <ChainPreview />
      <FarkleFlash />
      <ModePulse />
      <FrenzyInstabilityWarning />
      <ScorePopupLayer />
      <DisruptionToast />
      {showDisruptions && <DisruptionPanel onDisrupt={onDisrupt} gameMode={gameMode} />}
      {onRainmakerSelect && <RainmakerFacePicker onSelect={onRainmakerSelect} />}
      {isHeist && onInitiateHeist && onBlockHeist && (
        <HeistPanel onInitiate={onInitiateHeist} onBlock={onBlockHeist} />
      )}
      {isRally && onRallyBank && onRallyPass && onRallyContinue && (
        <RallyDecisionPanel onRallyBank={onRallyBank} onRallyPass={onRallyPass} onRallyContinue={onRallyContinue} />
      )}
    </div>
  );
}
