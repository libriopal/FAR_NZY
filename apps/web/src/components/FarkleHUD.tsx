import React, { useEffect, useRef, useState } from 'react';
import { useFarkleStore, MULTIPLIER_LADDER, MAX_ENERGY, FRENZY_THRESHOLD } from '../store/farkleStore.js';
import { WIN_SCORE } from '../hooks/useFarkleGame.js';
import type { DisruptionType } from '@match3d/farkle-shared';

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

function BankButton({ onBank, onBack }: { onBank: () => void; onBack: () => void }) {
  const unbanked = useFarkleStore(s => s.unbanked);

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

// ── Disruption Panel (multiplayer send) ───────────────────────────────────────

const DISRUPTION_DEFS: { type: DisruptionType; label: string; emoji: string; cooldownMs: number }[] = [
  { type: 'ice_send',   label: 'ICE',     emoji: '❄️', cooldownMs: 25_000 },
  { type: 'lock_send',  label: 'LOCK',    emoji: '🔒', cooldownMs: 35_000 },
  { type: 'scramble',   label: 'SCRAMBLE',emoji: '🌀', cooldownMs: 20_000 },
];

function DisruptionPanel({ onDisrupt }: { onDisrupt: (type: DisruptionType) => void }) {
  const [cooldowns, setCooldowns] = useState<Record<DisruptionType, number>>({
    ice_send: 0, lock_send: 0, scramble: 0,
  });
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  function fireDisrupt(type: DisruptionType, cooldownMs: number) {
    const ready = (cooldowns[type] ?? 0) <= 0;
    if (!ready) return;
    onDisrupt(type);
    const until = Date.now() + cooldownMs;
    setCooldowns(prev => ({ ...prev, [type]: cooldownMs }));
    const iv = setInterval(() => {
      const remaining = until - Date.now();
      if (remaining <= 0) {
        clearInterval(iv);
        setCooldowns(prev => ({ ...prev, [type]: 0 }));
      } else {
        setCooldowns(prev => ({ ...prev, [type]: remaining }));
      }
    }, 250);
    if (intervalsRef.current[type]) clearInterval(intervalsRef.current[type]);
    intervalsRef.current[type] = iv;
  }

  useEffect(() => () => {
    for (const iv of Object.values(intervalsRef.current)) clearInterval(iv);
  }, []);

  return (
    <div style={{
      position: 'absolute', bottom: 80, right: 12,
      display: 'flex', flexDirection: 'column', gap: 5, pointerEvents: 'auto',
    }}>
      {DISRUPTION_DEFS.map(({ type, label, emoji, cooldownMs }) => {
        const ms = cooldowns[type] ?? 0;
        const ready = ms <= 0;
        const secLeft = Math.ceil(ms / 1000);
        return (
          <button key={type} onClick={() => fireDisrupt(type, cooldownMs)} disabled={!ready} style={{
            background: ready ? 'rgba(124,58,237,0.35)' : 'var(--ba-card-bg)',
            border: `1px solid ${ready ? 'rgba(167,139,250,0.7)' : 'var(--ba-card-border)'}`,
            color: ready ? '#e9d5ff' : 'var(--ba-marble-800)',
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, fontWeight: 700, cursor: ready ? 'pointer' : 'default',
            fontFamily: 'monospace', whiteSpace: 'nowrap',
            boxShadow: ready ? '0 0 8px rgba(124,58,237,0.4)' : 'none',
            transition: 'all 0.15s ease',
          }}>
            {emoji} {ready ? label : `${secLeft}s`}
          </button>
        );
      })}
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

// ── Main HUD ──────────────────────────────────────────────────────────────────

interface FarkleHUDProps {
  onBank: () => void;
  onBack: () => void;
  onDisrupt?: (type: DisruptionType) => void;
}

export function FarkleHUD({ onBank, onBack, onDisrupt }: FarkleHUDProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <EnergyBar />
      <ScoreDisplay />
      <BankButton onBank={onBank} onBack={onBack} />
      <ChainPreview />
      <FarkleFlash />
      <ModePulse />
      <ScorePopupLayer />
      <DisruptionToast />
      {onDisrupt && <DisruptionPanel onDisrupt={onDisrupt} />}
    </div>
  );
}
