// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OV, CURRENCY, TYPE } from '../theme/tokens.js';
import { useGameStore } from '../store/gameStore.js';
import { LEVELS } from '../data/levels.js';
import { adManager } from '@match3d/ads';
import { analytics } from '@match3d/analytics';
import { savePlayerData, submitScore } from '@match3d/backend-client';

const GH = {
  void:        OV.void,
  neural:      OV.neural,
  bone:        OV.bone,
  boneDim:     OV.boneDim,
  gold:        OV.gold,
  goldBright:  OV.goldBright,
  goldGlow:    OV.goldGlow,
  goldDim:     OV.goldDim,
  cyan:        OV.cyan,
  cyanGlow:    OV.cyanGlow,
  magenta:     OV.magenta,
  magentaGlow: OV.magentaGlow,
  purpleMid:   CURRENCY.pdx.color,
  purpleGlow:  'rgba(123,47,255,0.45)',
  purpleText:  CURRENCY.pdx.particleColor,
  panelBg:     'rgba(5,0,18,0.96)',
  panelBorder: OV.goldDim,
} as const;

const CRT: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: `repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)`,
  zIndex: 0,
};

function FiligreeRow({ count = 5, color = GH.goldDim }: { count?: number; color?: string }) {
  const mid = Math.floor(count / 2);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) => {
        const size = i === mid ? 8 : i % 2 === 0 ? 5 : 3;
        return (
          <div key={i} style={{
            width: size, height: size, background: color,
            transform: 'rotate(45deg)',
            boxShadow: i === mid ? `0 0 6px ${color}` : 'none',
          }} />
        );
      })}
    </div>
  );
}

function navigateWithAd(nav: () => void) {
  adManager.showInterstitial();
  nav();
}

// ── Particle moment — reality law: win=cyan (virtual), lose=magenta (physical) ──

function ParticleMoment({ color }: { color: string }) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ fov: 60, position: [0, 0, 5] }}
        gl={{ antialias: false, alpha: true, powerPreference: 'default' }}
      >
        <Sparkles
          count={120}
          scale={7}
          size={1.8}
          speed={2.5}
          color={color}
          opacity={0.75}
        />
        <EffectComposer>
          <Bloom luminanceThreshold={0.4} luminanceSmoothing={0.1} intensity={1.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

// ── Score tally — rAF mutation, NOT useState for the running value ─────────────

function ScoreTally({ target, glowColor }: { target: number; glowColor: string }) {
  const elRef   = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number>(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start    = performance.now();
    const duration = 1200;

    function tick(now: number) {
      const t    = Math.min(1, (now - start) / duration);
      const ease = 1 - (1 - t) ** 3; // ease-out cubic
      if (elRef.current) {
        elRef.current.textContent = Math.round(ease * target).toLocaleString();
      }
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return (
    <span ref={elRef} style={{
      color: glowColor,
      fontSize: 34, fontWeight: 900, letterSpacing: 2,
      fontFamily: TYPE.fontDisplay,
      display: 'block',
      textShadow: done
        ? `0 0 28px ${glowColor}, 0 0 10px ${glowColor}, 0 0 4px ${glowColor}`
        : `0 0 14px ${glowColor}`,
      transition: 'text-shadow 0.45s ease',
    }}>
      0
    </span>
  );
}

// ── Win Screen ────────────────────────────────────────────────────────────────

export function WinScreen() {
  const { score, resources, economyBalance, userId, purchasedUpgradeIds, selectedLevelId } = useGameStore(s => ({
    score: s.score,
    resources: s.resources,
    economyBalance: s.economyBalance,
    userId: s.userId,
    purchasedUpgradeIds: s.purchasedUpgradeIds,
    selectedLevelId: s.selectedLevelId,
  }));
  const setActiveScreen      = useGameStore(s => s.setActiveScreen);
  const updateEconomyBalance = useGameStore(s => s.updateEconomyBalance);
  const [claimed, setClaimed] = useState(false);

  const levelDef     = LEVELS.find(l => l.id === selectedLevelId) ?? LEVELS[0]!;
  const levelWinScore = levelDef.winScore;

  const scoreMult  = score >= levelWinScore * 2 ? 2.0 : score >= levelWinScore * 1.5 ? 1.5 : 1.0;
  const goldReward = Math.round((100 + Math.floor(score / 10_000) * 20) * scoreMult);
  const scReward   = score >= levelWinScore * 2
    ? Math.floor(score / levelWinScore * 2.5) + 5
    : Math.floor(score / levelWinScore * 2.5);

  const claimReward = useCallback(async () => {
    if (claimed) return;
    setClaimed(true);
    const newBalance = {
      goldCoins:   economyBalance.goldCoins + goldReward,
      sweepsCoins: economyBalance.sweepsCoins + scReward,
      lastUpdated: Date.now(),
    };
    updateEconomyBalance(newBalance);
    analytics.track({
      name: 'level_complete',
      props: { levelId: selectedLevelId, score, timeRemaining: 0, objectivesCompleted: 1 },
    });
    if (userId) {
      try {
        await Promise.all([
          submitScore(selectedLevelId, score),
          savePlayerData(userId, {
            meta_resources: {
              bioSteel:    resources.bioSteel,
              aeroSeeds:   resources.aeroSeeds,
              goldCoins:   newBalance.goldCoins,
              sweepsCoins: newBalance.sweepsCoins,
            },
            purchased_upgrade_ids: purchasedUpgradeIds,
          }),
        ]);
      } catch { /* non-critical */ }
    }
  }, [claimed, goldReward, scReward, economyBalance, updateEconomyBalance, score, userId, resources, purchasedUpgradeIds, selectedLevelId]);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: GH.void,
      fontFamily: TYPE.fontCode, padding: 24, textAlign: 'center',
      backgroundImage: `radial-gradient(ellipse at 50% 30%, rgba(0,229,255,0.06) 0%, transparent 60%)`,
    }}>
      {/* Cyan virtual-reality particle burst — win = virtual breakthrough */}
      <ParticleMoment color={OV.cyan} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Top filigree */}
        <div style={{ marginBottom: 12 }}>
          <FiligreeRow count={9} color={GH.gold} />
        </div>

        {/* Rank glyph */}
        <div style={{
          fontSize: 56, lineHeight: 1,
          filter: `drop-shadow(0 0 18px ${GH.goldGlow})`,
          marginBottom: 8,
          animation: 'winPulse 2s ease-in-out infinite',
        }}>
          ✦
        </div>

        <div style={{ color: GH.goldDim, fontSize: 9, letterSpacing: 6, marginBottom: 4, fontFamily: TYPE.fontCode }}>
          {levelDef.id.replace('_', ' ').toUpperCase()}
        </div>

        <h2 style={{
          margin: '0 0 4px',
          color: GH.goldBright, fontSize: 22, fontWeight: 900, letterSpacing: 3,
          fontFamily: TYPE.fontDisplay,
          textShadow: `0 0 20px ${GH.goldGlow}, 0 0 40px ${GH.goldDim}`,
        }}>
          LATTICE CLEARED
        </h2>
        <div style={{ color: GH.boneDim, fontSize: 11, letterSpacing: 2, marginBottom: 20, fontFamily: TYPE.fontCode }}>
          {levelDef.name.toUpperCase()} — CONQUERED
        </div>

        {/* Score panel — tally animation via rAF */}
        <div style={{
          position: 'relative', background: GH.panelBg,
          border: `1px solid ${GH.panelBorder}`, borderRadius: 6,
          padding: '14px 32px', marginBottom: 14, minWidth: 220,
        }}>
          <div style={CRT} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ color: GH.goldDim, fontSize: 9, letterSpacing: 3, marginBottom: 6, fontFamily: TYPE.fontCode }}>
              FINAL SCORE
            </div>
            <ScoreTally target={score} glowColor={GH.goldBright} />
            <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, marginTop: 4, fontFamily: TYPE.fontCode }}>
              TARGET: {levelWinScore.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Reward panel — FAR_NZY currency labels */}
        <div style={{
          position: 'relative', background: GH.panelBg,
          border: `1px solid ${GH.panelBorder}`, borderRadius: 6,
          padding: '12px 28px', marginBottom: 24, minWidth: 220,
        }}>
          <div style={CRT} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              color: GH.goldDim, fontSize: 9, letterSpacing: 3, marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: TYPE.fontCode,
            }}>
              REWARDS
              {scoreMult > 1.0 && (
                <span style={{
                  background: scoreMult >= 2.0 ? GH.purpleMid : GH.magenta,
                  color: '#fff', fontSize: 8, borderRadius: 4,
                  padding: '1px 5px', fontWeight: 700, letterSpacing: 1,
                }}>
                  {scoreMult >= 2.0 ? '×2 BONUS' : '×1.5 BONUS'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
              <div>
                <div style={{ color: GH.gold, fontWeight: 700, fontSize: 20, textShadow: `0 0 8px ${GH.goldGlow}`, fontFamily: TYPE.fontCode }}>
                  +{goldReward}
                </div>
                <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, fontFamily: TYPE.fontCode }}>
                  {CURRENCY.fd.symbol}
                </div>
              </div>
              {scReward > 0 && (
                <div>
                  <div style={{ color: GH.cyan, fontWeight: 700, fontSize: 20, textShadow: `0 0 8px ${GH.cyanGlow}`, fontFamily: TYPE.fontCode }}>
                    +{scReward}
                  </div>
                  <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, fontFamily: TYPE.fontCode }}>
                    {CURRENCY.pdx.symbol}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <FiligreeRow count={5} color={GH.goldDim} />

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260, marginTop: 16 }}>
          {!claimed ? (
            <button onClick={claimReward} style={{
              background: `rgba(201,168,76,0.18)`,
              border: `1px solid ${GH.gold}`,
              color: GH.goldBright, borderRadius: 6,
              padding: '13px 0', fontSize: 13, cursor: 'pointer',
              fontFamily: TYPE.fontCode, fontWeight: 700, letterSpacing: 2,
              boxShadow: `0 0 18px ${GH.goldGlow}`,
              textShadow: `0 0 8px ${GH.goldGlow}`,
            }}>
              ⚑ CLAIM & CONTINUE
            </button>
          ) : (
            <button onClick={() => navigateWithAd(() => setActiveScreen('home'))} style={{
              background: `rgba(201,168,76,0.18)`,
              border: `1px solid ${GH.gold}`,
              color: GH.goldBright, borderRadius: 6,
              padding: '13px 0', fontSize: 13, cursor: 'pointer',
              fontFamily: TYPE.fontCode, fontWeight: 700, letterSpacing: 2,
            }}>
              CONTINUE →
            </button>
          )}
          <button onClick={() => navigateWithAd(() => setActiveScreen('game'))} style={{
            background: GH.panelBg,
            border: `1px solid ${GH.panelBorder}`,
            color: GH.boneDim, borderRadius: 6,
            padding: '11px 0', fontSize: 12, cursor: 'pointer',
            fontFamily: TYPE.fontCode, letterSpacing: 1,
          }}>
            ↺ REPLAY
          </button>
        </div>
      </div>

      <style>{`
        @keyframes winPulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 18px rgba(201,168,76,0.55)); }
          50%       { opacity: 0.82; filter: drop-shadow(0 0 30px rgba(201,168,76,0.9)); }
        }
      `}</style>
    </div>
  );
}

// ── Lose Screen — physical reality reasserts (magenta) ────────────────────────

export function LoseScreen() {
  const setActiveScreen  = useGameStore(s => s.setActiveScreen);
  const selectedLevelId  = useGameStore(s => s.selectedLevelId);
  const [reviving, setReviving]     = useState(false);
  const [reviveUsed, setReviveUsed] = useState(false);

  const levelDef = LEVELS.find(l => l.id === selectedLevelId) ?? LEVELS[0]!;

  const handleRevive = useCallback(async () => {
    if (reviving || reviveUsed) return;
    setReviving(true);
    try {
      const reward = await adManager.showRewarded('revive');
      if (reward) {
        analytics.track({
          name: 'ad_shown',
          props: { adType: 'rewarded', rewardType: 'revive' },
        });
        setReviveUsed(true);
        setActiveScreen('game');
      }
    } finally {
      setReviving(false);
    }
  }, [reviving, reviveUsed, setActiveScreen]);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: GH.void,
      fontFamily: TYPE.fontCode, padding: 24, textAlign: 'center',
      backgroundImage: `radial-gradient(ellipse at 50% 30%, rgba(255,0,204,0.06) 0%, transparent 60%)`,
    }}>
      {/* Magenta physical-reality particle bleed — lose = physical reality floods back */}
      <ParticleMoment color={OV.magenta} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Top filigree */}
        <div style={{ marginBottom: 12 }}>
          <FiligreeRow count={9} color={OV.magentaGlow} />
        </div>

        {/* Skull glyph */}
        <div style={{
          fontSize: 52, lineHeight: 1,
          filter: `drop-shadow(0 0 16px ${OV.magentaGlow})`,
          marginBottom: 10,
          animation: 'losePulse 2.5s ease-in-out infinite',
        }}>
          ✕
        </div>

        <div style={{ color: OV.magentaGlow, fontSize: 9, letterSpacing: 6, marginBottom: 4, fontFamily: TYPE.fontCode }}>
          {levelDef.id.replace('_', ' ').toUpperCase()}
        </div>

        <h2 style={{
          margin: '0 0 4px',
          color: OV.magentaBright, fontSize: 22, fontWeight: 900, letterSpacing: 3,
          fontFamily: TYPE.fontDisplay,
          textShadow: `0 0 18px ${OV.magentaGlow}, 0 0 36px rgba(255,0,204,0.25)`,
        }}>
          FARKLE COLLAPSE
        </h2>
        <div style={{ color: GH.boneDim, fontSize: 11, letterSpacing: 2, marginBottom: 28, fontFamily: TYPE.fontCode }}>
          {levelDef.name.toUpperCase()} — UNRESOLVED
        </div>

        <FiligreeRow count={5} color={OV.magentaGlow} />

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260, marginTop: 20 }}>
          {!reviveUsed && (
            <button onClick={handleRevive} disabled={reviving} style={{
              background: reviving ? GH.panelBg : 'rgba(123,47,255,0.22)',
              border: `1px solid ${reviving ? GH.purpleGlow : GH.purpleMid}`,
              color: reviving ? GH.boneDim : GH.purpleText,
              borderRadius: 6, padding: '13px 0', fontSize: 13,
              cursor: reviving ? 'default' : 'pointer',
              fontFamily: TYPE.fontCode, fontWeight: 700, letterSpacing: 2,
              boxShadow: reviving ? 'none' : `0 0 18px ${GH.purpleGlow}`,
            }}>
              {reviving ? 'LOADING...' : '▶ AD REVIVE'}
            </button>
          )}
          <button onClick={() => navigateWithAd(() => setActiveScreen('game'))} style={{
            background: `rgba(255,0,204,0.12)`,
            border: `1px solid ${OV.magenta}`,
            color: OV.magentaBright, borderRadius: 6,
            padding: '13px 0', fontSize: 13, cursor: 'pointer',
            fontFamily: TYPE.fontCode, fontWeight: 700, letterSpacing: 2,
            boxShadow: `0 0 14px ${OV.magentaGlow}`,
          }}>
            ↺ TRY AGAIN
          </button>
          <button onClick={() => navigateWithAd(() => setActiveScreen('home'))} style={{
            background: GH.panelBg,
            border: `1px solid ${GH.panelBorder}`,
            color: GH.boneDim, borderRadius: 6,
            padding: '11px 0', fontSize: 12, cursor: 'pointer',
            fontFamily: TYPE.fontCode, letterSpacing: 1,
          }}>
            ← HOME
          </button>
        </div>
      </div>

      <style>{`
        @keyframes losePulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 16px rgba(255,0,204,0.45)); }
          50%       { opacity: 0.65; filter: drop-shadow(0 0 28px rgba(255,0,204,0.8)); }
        }
      `}</style>
    </div>
  );
}
