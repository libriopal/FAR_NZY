// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { LEVELS } from '../data/levels.js';
import { adManager } from '@match3d/ads';
import { analytics } from '@match3d/analytics';
import { savePlayerData, submitScore } from '@match3d/backend-client';

// ── Gothic Hacker Neon palette ────────────────────────────────────────────────
const GH = {
  void:        '#050008',
  neural:      '#0d0018',
  bone:        '#e8d5a3',
  boneDim:     'rgba(232,213,163,0.45)',
  gold:        '#c9a84c',
  goldBright:  '#f0c860',
  goldGlow:    'rgba(201,168,76,0.55)',
  goldDim:     'rgba(201,168,76,0.22)',
  cyan:        '#00e5ff',
  cyanGlow:    'rgba(0,229,255,0.45)',
  magenta:     '#ff00cc',
  magentaGlow: 'rgba(255,0,204,0.45)',
  danger:      '#ef4444',
  dangerGlow:  'rgba(239,68,68,0.45)',
  purpleMid:   '#7b2fff',
  purpleGlow:  'rgba(123,47,255,0.45)',
  panelBg:     'rgba(5,0,18,0.96)',
  panelBorder: 'rgba(201,168,76,0.42)',
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
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const updateEconomyBalance = useGameStore(s => s.updateEconomyBalance);
  const [claimed, setClaimed] = useState(false);

  const levelDef = LEVELS.find(l => l.id === selectedLevelId) ?? LEVELS[0]!;
  const levelWinScore = levelDef.winScore;

  // Score multiplier tiers relative to level target
  const scoreMult = score >= levelWinScore * 2 ? 2.0 : score >= levelWinScore * 1.5 ? 1.5 : 1.0;
  const goldReward = Math.round((100 + Math.floor(score / 10_000) * 20) * scoreMult);
  const scReward = score >= levelWinScore * 2
    ? Math.floor(score / levelWinScore * 2.5) + 5
    : Math.floor(score / levelWinScore * 2.5);

  const claimReward = useCallback(async () => {
    if (claimed) return;
    setClaimed(true);
    const newBalance = {
      goldCoins: economyBalance.goldCoins + goldReward,
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
              bioSteel: resources.bioSteel,
              aeroSeeds: resources.aeroSeeds,
              goldCoins: newBalance.goldCoins,
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
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: GH.void,
      fontFamily: 'monospace', padding: 24, textAlign: 'center',
      backgroundImage: `radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.08) 0%, transparent 60%)`,
    }}>
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

      <div style={{
        color: GH.goldDim, fontSize: 9, letterSpacing: 6, marginBottom: 4,
      }}>
        {levelDef.id.replace('_', ' ').toUpperCase()}
      </div>

      <h2 style={{
        margin: '0 0 4px',
        color: GH.goldBright, fontSize: 22, fontWeight: 900, letterSpacing: 3,
        textShadow: `0 0 20px ${GH.goldGlow}, 0 0 40px ${GH.goldDim}`,
      }}>
        LATTICE CLEARED
      </h2>
      <div style={{ color: GH.boneDim, fontSize: 11, letterSpacing: 2, marginBottom: 20 }}>
        {levelDef.name.toUpperCase()} — CONQUERED
      </div>

      {/* Score panel */}
      <div style={{
        position: 'relative', background: GH.panelBg,
        border: `1px solid ${GH.panelBorder}`, borderRadius: 6,
        padding: '14px 32px', marginBottom: 14, minWidth: 220,
      }}>
        <div style={CRT} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: GH.goldDim, fontSize: 9, letterSpacing: 3, marginBottom: 6 }}>FINAL SCORE</div>
          <div style={{
            color: GH.goldBright, fontSize: 34, fontWeight: 900, letterSpacing: 2,
            textShadow: `0 0 14px ${GH.goldGlow}`,
          }}>
            {score.toLocaleString()}
          </div>
          <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1, marginTop: 4 }}>
            TARGET: {levelWinScore.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Reward panel */}
      <div style={{
        position: 'relative', background: GH.panelBg,
        border: `1px solid ${GH.panelBorder}`, borderRadius: 6,
        padding: '12px 28px', marginBottom: 24, minWidth: 220,
      }}>
        <div style={CRT} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: GH.goldDim, fontSize: 9, letterSpacing: 3, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
              <div style={{ color: GH.gold, fontWeight: 700, fontSize: 20, textShadow: `0 0 8px ${GH.goldGlow}` }}>+{goldReward}</div>
              <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1 }}>GOLD</div>
            </div>
            {scReward > 0 && (
              <div>
                <div style={{ color: GH.cyan, fontWeight: 700, fontSize: 20, textShadow: `0 0 8px ${GH.cyanGlow}` }}>+{scReward}</div>
                <div style={{ color: GH.boneDim, fontSize: 9, letterSpacing: 1 }}>SWEEPS</div>
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
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
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
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
          }}>
            CONTINUE →
          </button>
        )}
        <button onClick={() => navigateWithAd(() => setActiveScreen('game'))} style={{
          background: GH.panelBg,
          border: `1px solid ${GH.panelBorder}`,
          color: GH.boneDim, borderRadius: 6,
          padding: '11px 0', fontSize: 12, cursor: 'pointer',
          fontFamily: 'monospace', letterSpacing: 1,
        }}>
          ↺ REPLAY
        </button>
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

// ── Lose Screen ───────────────────────────────────────────────────────────────

export function LoseScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const [reviving, setReviving] = useState(false);
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
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: GH.void,
      fontFamily: 'monospace', padding: 24, textAlign: 'center',
      backgroundImage: `radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.06) 0%, transparent 60%)`,
    }}>
      {/* Top filigree */}
      <div style={{ marginBottom: 12 }}>
        <FiligreeRow count={9} color='rgba(239,68,68,0.4)' />
      </div>

      {/* Skull glyph */}
      <div style={{
        fontSize: 52, lineHeight: 1,
        filter: `drop-shadow(0 0 16px ${GH.dangerGlow})`,
        marginBottom: 10,
        animation: 'losePulse 2.5s ease-in-out infinite',
      }}>
        ✕
      </div>

      <div style={{
        color: 'rgba(239,68,68,0.5)', fontSize: 9, letterSpacing: 6, marginBottom: 4,
      }}>
        {levelDef.id.replace('_', ' ').toUpperCase()}
      </div>

      <h2 style={{
        margin: '0 0 4px',
        color: GH.danger, fontSize: 22, fontWeight: 900, letterSpacing: 3,
        textShadow: `0 0 18px ${GH.dangerGlow}, 0 0 36px rgba(239,68,68,0.25)`,
      }}>
        FARKLE COLLAPSE
      </h2>
      <div style={{ color: GH.boneDim, fontSize: 11, letterSpacing: 2, marginBottom: 28 }}>
        {levelDef.name.toUpperCase()} — UNRESOLVED
      </div>

      <FiligreeRow count={5} color='rgba(239,68,68,0.3)' />

      {/* CTA buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260, marginTop: 20 }}>
        {!reviveUsed && (
          <button onClick={handleRevive} disabled={reviving} style={{
            background: reviving ? GH.panelBg : 'rgba(123,47,255,0.22)',
            border: `1px solid ${reviving ? GH.purpleGlow : GH.purpleMid}`,
            color: reviving ? GH.boneDim : '#e9d5ff',
            borderRadius: 6, padding: '13px 0', fontSize: 13,
            cursor: reviving ? 'default' : 'pointer',
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
            boxShadow: reviving ? 'none' : `0 0 18px ${GH.purpleGlow}`,
          }}>
            {reviving ? 'LOADING...' : '▶ AD REVIVE'}
          </button>
        )}
        <button onClick={() => navigateWithAd(() => setActiveScreen('game'))} style={{
          background: `rgba(239,68,68,0.15)`,
          border: `1px solid ${GH.danger}`,
          color: '#fca5a5', borderRadius: 6,
          padding: '13px 0', fontSize: 13, cursor: 'pointer',
          fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2,
          boxShadow: `0 0 14px ${GH.dangerGlow}`,
        }}>
          ↺ TRY AGAIN
        </button>
        <button onClick={() => navigateWithAd(() => setActiveScreen('home'))} style={{
          background: GH.panelBg,
          border: `1px solid ${GH.panelBorder}`,
          color: GH.boneDim, borderRadius: 6,
          padding: '11px 0', fontSize: 12, cursor: 'pointer',
          fontFamily: 'monospace', letterSpacing: 1,
        }}>
          ← HOME
        </button>
      </div>

      <style>{`
        @keyframes losePulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 16px rgba(239,68,68,0.45)); }
          50%       { opacity: 0.65; filter: drop-shadow(0 0 28px rgba(239,68,68,0.8)); }
        }
      `}</style>
    </div>
  );
}
