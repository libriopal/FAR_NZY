// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Win/lose transition: crack → bleed → shatter phases.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useFarkleStore } from '../store/farkleStore.js';

type Phase = 'crack' | 'bleed' | 'shatter' | 'done';

const PHASE_MS: Record<Phase, number> = {
  crack: 400,
  bleed: 500,
  shatter: 600,
  done: 0,
};

const OVERLAY_COLOR: Record<'win' | 'lose', string> = {
  win: '#10b981',
  lose: '#ef4444',
};

export function TransitionOverlay() {
  const gamePhase = useFarkleStore(s => s.gamePhase);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null);

  useEffect(() => {
    if (gamePhase === 'win' || gamePhase === 'lose') {
      setOutcome(gamePhase);
      setPhase('crack');
    }
  }, [gamePhase]);

  useEffect(() => {
    if (!phase || phase === 'done') return;
    const next: Record<Phase, Phase> = { crack: 'bleed', bleed: 'shatter', shatter: 'done', done: 'done' };
    const timer = setTimeout(() => setPhase(next[phase]), PHASE_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  if (!phase || phase === 'done' || !outcome) return null;

  const color = OVERLAY_COLOR[outcome];
  const opacity = phase === 'crack' ? 0.25 : phase === 'bleed' ? 0.55 : 0.85;
  const animName = phase === 'shatter' ? 'shatter' : phase === 'bleed' ? 'bleed' : 'crack';

  return (
    <>
      <style>{`
        @keyframes crack {
          0%   { clip-path: polygon(0 0,100% 0,100% 100%,0 100%); opacity:0; }
          50%  { clip-path: polygon(2% 0,100% 3%,98% 100%,0 97%); opacity:0.3; }
          100% { clip-path: polygon(1% 2%,99% 0,100% 98%,0 100%); opacity:0.25; }
        }
        @keyframes bleed {
          0%   { transform:scaleY(1); opacity:0.25; }
          40%  { transform:scaleY(1.04); opacity:0.6; }
          100% { transform:scaleY(1); opacity:0.55; }
        }
        @keyframes shatter {
          0%   { opacity:0.55; transform:scale(1); filter:blur(0px); }
          60%  { opacity:0.9; transform:scale(1.02); filter:blur(1px); }
          100% { opacity:0.85; transform:scale(1); filter:blur(2px); }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'none',
        background: color,
        opacity,
        animation: `${animName} ${PHASE_MS[phase]}ms ease-in-out forwards`,
        mixBlendMode: 'screen',
      }} />
    </>
  );
}
