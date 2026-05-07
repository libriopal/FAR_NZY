import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { adManager } from '@match3d/ads';
import { analytics } from '@match3d/analytics';
import { savePlayerData, submitScore } from '@match3d/backend-client';

export function WinScreen() {
  const { score, resources, economyBalance, userId, purchasedUpgradeIds } = useGameStore(s => ({
    score: s.score,
    resources: s.resources,
    economyBalance: s.economyBalance,
    userId: s.userId,
    purchasedUpgradeIds: s.purchasedUpgradeIds,
  }));
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const updateEconomyBalance = useGameStore(s => s.updateEconomyBalance);
  const [claimed, setClaimed] = useState(false);

  const scoreMult = score >= 100_000 ? 2.0 : score >= 50_000 ? 1.5 : 1.0;
  const goldReward = Math.round((100 + Math.floor(score / 10_000) * 20) * scoreMult);
  const scReward = score >= 100_000
    ? Math.floor(score / 50_000) + 5
    : Math.floor(score / 50_000);

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
      props: { levelId: 'farkle', score, timeRemaining: 0, objectivesCompleted: 1 },
    });
    if (userId) {
      try {
        await Promise.all([
          submitScore('farkle', score),
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
  }, [claimed, goldReward, scReward, economyBalance, updateEconomyBalance, score, userId, resources, purchasedUpgradeIds]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'radial-gradient(ellipse at center, #0d2a14 0%, #0a1628 70%)',
      color: '#5de58a', fontFamily: 'monospace', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>🌿</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px',
        textShadow: '0 0 20px #5de58a80' }}>Blueprint Complete</h2>
      <p style={{ color: '#4a9a6a', fontSize: 14, marginBottom: 24 }}>
        The greenhouse grows stronger.
      </p>

      {/* Score card */}
      <div style={{
        background: 'rgba(13,32,64,0.8)', borderRadius: 12, border: '1px solid #1a4060',
        padding: '20px 40px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#7ecfff' }}>
          {score.toLocaleString()}
        </div>
        <div style={{ color: '#4a8a9a', fontSize: 14 }}>Score</div>
      </div>

      {/* Reward card */}
      <div style={{
        background: 'rgba(10,42,20,0.6)', borderRadius: 12, border: '1px solid #1a4a2a',
        padding: '16px 32px', marginBottom: 28,
      }}>
        <div style={{ color: '#2a9a5a', fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          Rewards
          {scoreMult > 1.0 && (
            <span style={{
              background: scoreMult >= 2.0 ? '#7c3aed' : '#1a6fd4',
              color: '#fff', fontSize: 10, borderRadius: 6, padding: '2px 6px', fontWeight: 700,
            }}>
              {scoreMult >= 2.0 ? '2× BONUS' : '1.5× BONUS'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <div>
            <div style={{ color: '#ffd700', fontWeight: 700, fontSize: 18 }}>+{goldReward}</div>
            <div style={{ color: '#4a8a4a', fontSize: 11 }}>Gold Coins</div>
          </div>
          {scReward > 0 && (
            <div>
              <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: 18 }}>+{scReward}</div>
              <div style={{ color: '#4a8a4a', fontSize: 11 }}>Sweeps Coins</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexDirection: 'column', width: '100%', maxWidth: 300 }}>
        {!claimed ? (
          <button onClick={claimReward} style={{
            background: '#1a6fd4', border: 'none', color: '#fff', borderRadius: 10,
            padding: '14px 48px', fontSize: 16, cursor: 'pointer', fontFamily: 'monospace',
            fontWeight: 700, boxShadow: '0 0 20px rgba(26,111,212,0.5)',
          }}>
            Claim & Continue
          </button>
        ) : (
          <button onClick={() => setActiveScreen('home')} style={{
            background: '#1a6fd4', border: 'none', color: '#fff', borderRadius: 10,
            padding: '14px 48px', fontSize: 16, cursor: 'pointer', fontFamily: 'monospace',
            fontWeight: 700,
          }}>
            Continue →
          </button>
        )}
        <button onClick={() => setActiveScreen('game')} style={{
          background: 'transparent', border: '1px solid #1a4060', color: '#4a8a9a',
          borderRadius: 10, padding: '12px 48px', fontSize: 14, cursor: 'pointer', fontFamily: 'monospace',
        }}>
          Play Again
        </button>
      </div>
    </div>
  );
}

export function LoseScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const [reviving, setReviving] = useState(false);
  const [reviveUsed, setReviveUsed] = useState(false);

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
        // Signal game to continue — navigate back to game
        setActiveScreen('game');
      }
    } finally {
      setReviving(false);
    }
  }, [reviving, reviveUsed, setActiveScreen]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'radial-gradient(ellipse at center, #200a0a 0%, #0a1628 70%)',
      color: '#ff6060', fontFamily: 'monospace', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>💀</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Scaffold Collapsed</h2>
      <p style={{ color: '#6a2a2a', fontSize: 14, marginBottom: 32 }}>
        The overgrowth has won this round.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
        {!reviveUsed && (
          <button onClick={handleRevive} disabled={reviving} style={{
            background: reviving ? '#1a1a1a' : '#7a2aaa',
            border: 'none', color: '#fff', borderRadius: 10,
            padding: '14px 24px', fontSize: 15, cursor: reviving ? 'default' : 'pointer',
            fontFamily: 'monospace', fontWeight: 700,
            boxShadow: reviving ? 'none' : '0 0 20px rgba(122,42,170,0.5)',
          }}>
            {reviving ? 'Loading Ad...' : '▶ Watch Ad → Revive'}
          </button>
        )}
        <button onClick={() => setActiveScreen('game')} style={{
          background: '#1a6fd4', border: 'none', color: '#fff', borderRadius: 10,
          padding: '14px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
        }}>
          ↺ Try Again
        </button>
        <button onClick={() => setActiveScreen('home')} style={{
          background: 'transparent', border: '1px solid #3a1a1a', color: '#6a2a2a',
          borderRadius: 10, padding: '14px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'monospace',
        }}>
          Home
        </button>
      </div>
    </div>
  );
}
