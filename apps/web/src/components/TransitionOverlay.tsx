// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Win/lose transition: crack → bleed → shatter phases.
// Reality law: win = cyan (virtual breakthrough), lose = magenta (physical reality reasserts).
// ─────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFarkleStore } from '../store/farkleStore.js';
import { OV } from '../theme/tokens.js';

type Phase = 'crack' | 'bleed' | 'shatter' | 'done';

const PHASE_MS: Record<Phase, number> = {
  crack:   400,
  bleed:   500,
  shatter: 600,
  done:    0,
};

// Reality duality: win = virtual (cyan), lose = physical reality reasserts (magenta)
const REALITY_COLOR: Record<'win' | 'lose', string> = {
  win:  OV.cyan,    // #00e5ff — virtual breakthrough
  lose: OV.magenta, // #ff00cc — physical reality floods back
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TransitionOverlay() {
  const gamePhase = useFarkleStore(s => s.gamePhase);
  const [phase, setPhase]     = useState<Phase | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'lose' | null>(null);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (gamePhase === 'win' || gamePhase === 'lose') {
      setOutcome(gamePhase);
      setPhase('crack');
    }
  }, [gamePhase]);

  useEffect(() => {
    if (!phase || phase === 'done') return;
    const next: Record<Phase, Phase> = {
      crack: 'bleed', bleed: 'shatter', shatter: 'done', done: 'done',
    };
    const timer = setTimeout(() => setPhase(next[phase]), PHASE_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  const visible = phase !== null && phase !== 'done' && outcome !== null;
  const color   = outcome ? REALITY_COLOR[outcome] : OV.cyan;

  // Opacity targets per phase
  const opacityByPhase: Record<Phase, number> = {
    crack: 0.25, bleed: 0.55, shatter: 0.85, done: 0,
  };
  const targetOpacity = phase ? opacityByPhase[phase] : 0;

  // Reduced-motion: instant flash, no animation
  if (reduced.current) {
    return visible ? (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'none',
        background: color, opacity: 0.5, mixBlendMode: 'screen',
      }} />
    ) : null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${outcome}-${phase}`}
          initial={{ opacity: 0, scaleY: 1 }}
          animate={{
            opacity:  targetOpacity,
            scaleY:   phase === 'bleed' ? 1.04 : 1,
            filter:   phase === 'shatter' ? 'blur(2px)' : 'blur(0px)',
            scale:    phase === 'shatter' ? 1.02 : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: (PHASE_MS[phase ?? 'crack'] ?? 400) / 1000, ease: 'easeInOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'none',
            background: color,
            mixBlendMode: 'screen',
            clipPath: phase === 'crack'
              ? 'polygon(1% 2%, 99% 0%, 100% 98%, 0% 100%)'
              : 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
          }}
        />
      )}
    </AnimatePresence>
  );
}
