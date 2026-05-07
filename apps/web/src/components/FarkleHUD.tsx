import React, { useEffect, useRef, useState } from 'react';
import { useFarkleStore, MULTIPLIER_LADDER, MAX_ENERGY, FRENZY_THRESHOLD } from '../store/farkleStore.js';
import { WIN_SCORE } from '../hooks/useFarkleGame.js';

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
          setPopups(p => [...p, { id, text: `+${delta.toLocaleString()}`, color: '#ffd700' }]);
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
        color: '#ff4040', fontSize: 32, fontWeight: 900, fontFamily: 'monospace',
        textShadow: '0 0 16px #ff0000', letterSpacing: 4,
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
      if (mode === 'FRENZY') setPulse({ color: '#ff6040', label: 'FRENZY!' });
      else if (mode === 'PRIME') setPulse({ color: '#3af', label: 'PRIME' });
      else setPulse({ color: '#4a6080', label: 'NORMAL' });
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
  const barColor = mode === 'FRENZY' ? '#ff6040' : mode === 'PRIME' ? '#3af' : '#335';
  const label = mode === 'FRENZY' ? 'FRENZY' : mode === 'PRIME' ? 'PRIME' : 'NORMAL';
  const labelColor = mode === 'FRENZY' ? '#ff6040' : mode === 'PRIME' ? '#7ecfff' : '#4a6080';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: 32, background: '#0d2040',
      display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 8, gap: 8,
    }}>
      <span style={{ color: labelColor, fontSize: 11, fontFamily: 'monospace', fontWeight: 700, minWidth: 52 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, background: '#0a1628', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: `${(FRENZY_THRESHOLD / MAX_ENERGY) * 100}%`,
          top: 0, bottom: 0, width: 1, background: '#ff604060',
        }} />
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor,
          transition: 'width 0.1s linear',
          boxShadow: `0 0 4px ${barColor}`,
        }} />
      </div>
      <span style={{ color: '#4a6080', fontSize: 10, fontFamily: 'monospace', minWidth: 32, textAlign: 'right' }}>
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
      position: 'absolute', top: 38, left: '50%', transform: 'translateX(-50%)',
      textAlign: 'center', pointerEvents: 'none',
    }}>
      <div style={{ color: '#7ecfff', fontSize: 22, fontWeight: 700, fontFamily: 'monospace', textShadow: '0 0 8px #3af' }}>
        {total.toLocaleString()}
      </div>
      <div style={{ width: 120, height: 3, background: '#0a2040', borderRadius: 2, margin: '3px auto 0' }}>
        <div style={{
          height: '100%', width: `${progressPct}%`,
          background: '#ffd700', borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ color: '#4a6080', fontSize: 9, fontFamily: 'monospace' }}>
        {total.toLocaleString()} / {WIN_SCORE.toLocaleString()}
      </div>
      {mult > 1 && (
        <div style={{ color: '#d4a0ff', fontSize: 12, fontFamily: 'monospace' }}>×{mult} multiplier</div>
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
            background: FACE_COLOR[face] ?? '#7ecfff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
            boxShadow: `0 0 8px ${FACE_COLOR[face] ?? '#7ecfff'}`,
          }}>
            {face}
          </div>
        ))}
      </div>
      <div style={{
        color: isFarkle ? '#ff6060' : '#ffd700',
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
    <div style={{ position: 'absolute', top: 38, right: 12, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'auto' }}>
      {unbanked > 0 && (
        <button onClick={onBank} style={{
          background: '#1a6fd4', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px',
          fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
        }}>
          BANK {unbanked.toLocaleString()}
        </button>
      )}
      <button onClick={onBack} style={{
        background: 'transparent', border: '1px solid #1a4060', color: '#4a8a9a',
        borderRadius: 8, padding: '4px 10px',
        fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
      }}>
        ← Exit
      </button>
    </div>
  );
}

// ── Main HUD ──────────────────────────────────────────────────────────────────

interface FarkleHUDProps {
  onBank: () => void;
  onBack: () => void;
}

export function FarkleHUD({ onBank, onBack }: FarkleHUDProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <EnergyBar />
      <ScoreDisplay />
      <BankButton onBank={onBank} onBack={onBack} />
      <ChainPreview />
      <FarkleFlash />
      <ModePulse />
      <ScorePopupLayer />
    </div>
  );
}
