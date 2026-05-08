// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { DEFAULT_PRICING_TIERS, AD_REWARD_AMOUNTS, BATTLE_PASS_TIERS } from '@match3d/economy';
import type { BattlePassTier } from '@match3d/economy';
import { useEconomy } from '../hooks/useEconomy.js';
import { adManager } from '@match3d/ads';
import { analytics } from '@match3d/analytics';

// LTO: 3 rotating bundles, each active for 48h
const LTO_BUNDLES = [
  { id: 'lto_starter_boost', label: 'Starter Boost', gold: 5_000, sc: 50, usdCents: 499, desc: 'Perfect for new blueprints' },
  { id: 'lto_vine_pack',     label: 'Vine Pack',     gold: 15_000, sc: 150, usdCents: 999, desc: 'Expand your canopy fast' },
  { id: 'lto_dome_bundle',   label: 'Dome Bundle',   gold: 35_000, sc: 500, usdCents: 1999, desc: 'Full greenhouse expansion' },
] as const;

function getCurrentLtoBundleIndex() {
  // 48h windows; rotate through 3 bundles deterministically
  return Math.floor(Date.now() / (48 * 3_600_000)) % LTO_BUNDLES.length;
}

export function ShopScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const economyBalance = useGameStore(s => s.economyBalance);
  const updateEconomyBalance = useGameStore(s => s.updateEconomyBalance);
  const userId = useGameStore(s => s.userId);
  const { claimBattlePassTier } = useEconomy();

  const [watchingAd, setWatchingAd] = useState(false);
  const [adCooldown, setAdCooldown] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [claimedTiers, setClaimedTiers] = useState<Set<number>>(new Set());

  const ltoBundle = useMemo(() => LTO_BUNDLES[getCurrentLtoBundleIndex()]!, []);
  const isFirstPurchase = economyBalance.goldCoins <= 500; // still at starter balance

  // LTO countdown: ms until next 48h window
  const ltoMsLeft = useMemo(() => {
    const windowMs = 48 * 3_600_000;
    return windowMs - (Date.now() % windowMs);
  }, []);
  const ltoHoursLeft = Math.ceil(ltoMsLeft / 3_600_000);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  }, []);

  const handleWatchAd = useCallback(async () => {
    if (watchingAd || adCooldown) return;
    setWatchingAd(true);
    try {
      const reward = await adManager.showRewarded('daily_free');
      if (reward) {
        updateEconomyBalance({
          goldCoins: economyBalance.goldCoins + reward.goldCoins,
          sweepsCoins: economyBalance.sweepsCoins + reward.sweepsCoins,
          lastUpdated: Date.now(),
        });
        analytics.track({
          name: 'ad_reward_claimed',
          props: { rewardType: 'daily_free', goldCoins: reward.goldCoins, sweepsCoins: reward.sweepsCoins },
        });
        showToast(`+${reward.goldCoins} Gold Coins earned!`);
        setAdCooldown(true);
        setTimeout(() => setAdCooldown(false), 30_000);
      }
    } finally {
      setWatchingAd(false);
    }
  }, [watchingAd, adCooldown, economyBalance, updateEconomyBalance, showToast]);

  const handleIAP = useCallback((tierId: string, usdCents: number, gold: number) => {
    analytics.track({
      name: 'purchase',
      props: { tierId, usdCents, goldCoins: gold },
    });
    showToast('IAP coming soon — no purchase necessary!');
  }, [showToast]);

  const handleBattlePassClaim = useCallback(async (tierDef: BattlePassTier) => {
    if (claimedTiers.has(tierDef.tier)) return;
    const ok = await claimBattlePassTier(tierDef);
    if (ok) {
      setClaimedTiers(prev => new Set([...prev, tierDef.tier]));
      analytics.track({ name: 'purchase', props: { tierId: `bp_t${tierDef.tier}`, usdCents: 0, goldCoins: tierDef.goldReward } });
      showToast(`Tier ${tierDef.tier} — ${tierDef.label} claimed!`);
    } else {
      showToast('Not enough Gold Coins.');
    }
  }, [claimedTiers, claimBattlePassTier, showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--ba-surface-bg)',
      color: 'var(--ba-marble-200)', fontFamily: 'monospace', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid var(--ba-glass-border)',
        background: 'var(--ba-glass-bg)',
        backdropFilter: 'var(--ba-glass-blur)', WebkitBackdropFilter: 'var(--ba-glass-blur)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ba-accent)' }}>Gold Vault</div>
          <div style={{ color: 'var(--ba-marble-500)', fontSize: 11 }}>Fuel your blueprint expansion</div>
        </div>
        <BalancePill gold={economyBalance.goldCoins} sc={economyBalance.sweepsCoins} />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Limited-Time Offer Banner */}
        <div className="ba-glass" style={{
          border: '1px solid var(--ba-blueprint)',
          borderRadius: 14, padding: '16px 18px',
          boxShadow: '0 0 20px var(--ba-blueprint-glow)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ background: 'var(--ba-blueprint)', color: '#fff', fontSize: 10, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  LIMITED TIME
                </span>
                <span style={{ color: 'var(--ba-marble-200)', fontSize: 11 }}>⏰ {ltoHoursLeft}h left</span>
              </div>
              <div style={{ color: 'var(--ba-marble-200)', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{ltoBundle.label}</div>
              <div style={{ color: 'var(--ba-marble-500)', fontSize: 11, marginBottom: 8 }}>{ltoBundle.desc}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: 'var(--ba-glow-amber)', fontSize: 13 }}>🟡 {ltoBundle.gold.toLocaleString()}</span>
                <span style={{ color: 'var(--ba-glow-teal)', fontSize: 13 }}>💎 +{ltoBundle.sc} SC</span>
              </div>
            </div>
            <button
              onClick={() => handleIAP(ltoBundle.id, ltoBundle.usdCents, ltoBundle.gold)}
              style={{
                background: 'var(--ba-blueprint)', border: 'none', color: '#fff',
                borderRadius: 10, padding: '10px 16px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                boxShadow: '0 4px 16px var(--ba-blueprint-glow)',
              }}
            >
              ${(ltoBundle.usdCents / 100).toFixed(2)}
            </button>
          </div>
        </div>

        {/* Daily Free Ad */}
        <Section title="Free Daily Reward">
          <button onClick={handleWatchAd} disabled={watchingAd || adCooldown} style={{
            ...actionBtnStyle,
            background: adCooldown ? 'var(--ba-card-bg)' : 'var(--ba-accent)',
            border: `1px solid ${adCooldown ? 'var(--ba-card-border)' : 'transparent'}`,
            opacity: adCooldown ? 0.5 : 1,
            width: '100%',
          }}>
            {watchingAd ? 'Loading Ad...' : adCooldown ? '✓ Claimed — check back soon' : '▶ Watch Ad → +200 Gold + 5 SC'}
          </button>
          <p style={{ color: 'var(--ba-marble-800)', fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>
            NO PURCHASE NECESSARY. Ad reward available once every 30 seconds in dev.
          </p>
        </Section>

        {/* Gold Coin Packages */}
        <Section title="Gold Coin Packages">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEFAULT_PRICING_TIERS.map((tier, i) => {
              const showFirstBonus = isFirstPurchase && i === 0;
              return (
                <div key={tier.id} className="ba-glass" style={{
                  ...tierRowStyle,
                  border: `1px solid ${showFirstBonus ? 'var(--ba-glow-amber)' : 'var(--ba-card-border)'}`,
                  boxShadow: showFirstBonus ? '0 0 10px var(--ba-accent-glow)' : 'none',
                }} onClick={() => handleIAP(tier.id, tier.usdCents, tier.goldCoins)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ba-marble-200)' }}>
                      {tier.label}
                      {showFirstBonus && (
                        <span style={{ background: 'var(--ba-glow-amber)', color: '#1a0a00', fontSize: 9, borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>
                          3× FIRST PURCHASE
                        </span>
                      )}
                    </div>
                    <div style={{ color: 'var(--ba-glow-amber)', fontSize: 13 }}>
                      {showFirstBonus ? (tier.goldCoins * 3).toLocaleString() : tier.goldCoins.toLocaleString()} Gold
                      {tier.sweepsCoinsBonus > 0 && (
                        <span style={{ color: 'var(--ba-glow-teal)', marginLeft: 8 }}>+{tier.sweepsCoinsBonus} SC</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ba-safe)' }}>
                    ${(tier.usdCents / 100).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ color: 'var(--ba-marble-800)', fontSize: 10, margin: '10px 0 0', textAlign: 'center' }}>
            Gold Coins have no cash value. For entertainment only.
          </p>
        </Section>

        {/* Battle Pass */}
        <Section title="Blueprint Pass — Season 1">
          <div className="ba-glass" style={{ borderRadius: 12, padding: '14px 16px', marginBottom: 0 }}>
            <div style={{ color: 'var(--ba-marble-500)', fontSize: 11, marginBottom: 10 }}>
              10 tiers • 500 Gold each • SC rewards at T5 & T10
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BATTLE_PASS_TIERS.map(tierDef => {
                const claimed = claimedTiers.has(tierDef.tier);
                const canAfford = economyBalance.goldCoins >= tierDef.goldCost;
                return (
                  <div key={tierDef.tier} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: claimed ? 'rgba(74,222,128,0.08)' : tierDef.isMilestone ? 'rgba(34,211,238,0.06)' : 'var(--ba-card-bg)',
                    border: `1px solid ${claimed ? 'var(--ba-glow-green)' : tierDef.isMilestone ? 'var(--ba-blueprint)' : 'var(--ba-card-border)'}`,
                  }}>
                    <span style={{ color: 'var(--ba-marble-800)', fontSize: 10, minWidth: 18 }}>T{tierDef.tier}</span>
                    <span style={{ flex: 1, color: 'var(--ba-marble-200)', fontSize: 12, fontWeight: tierDef.isMilestone ? 700 : 400 }}>
                      {tierDef.label}
                      {tierDef.isMilestone && <span style={{ color: 'var(--ba-blueprint)', fontSize: 10, marginLeft: 6 }}>★</span>}
                    </span>
                    <span style={{ color: 'var(--ba-glow-amber)', fontSize: 11 }}>+{tierDef.goldReward.toLocaleString()}</span>
                    {tierDef.scReward > 0 && (
                      <span style={{ color: 'var(--ba-glow-teal)', fontSize: 11 }}>+{tierDef.scReward} SC</span>
                    )}
                    {claimed ? (
                      <span style={{ color: 'var(--ba-glow-green)', fontSize: 11 }}>✓</span>
                    ) : (
                      <button onClick={() => void handleBattlePassClaim(tierDef)} style={{
                        background: canAfford ? 'var(--ba-accent)' : 'var(--ba-card-bg)',
                        border: 'none', color: canAfford ? '#fff' : 'var(--ba-marble-800)',
                        borderRadius: 6, padding: '4px 10px',
                        fontSize: 11, fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed',
                        fontFamily: 'monospace', whiteSpace: 'nowrap',
                      }}>
                        {tierDef.goldCost}g
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Sweeps Coins info */}
        <Section title="Sweeps Coins (SC)">
          <div className="ba-glass" style={{ borderRadius: 10, padding: 14 }}>
            <div style={{ color: 'var(--ba-glow-teal)', fontSize: 13, marginBottom: 8 }}>
              Sweeps Coins are earned free via:
            </div>
            <ul style={{ color: 'var(--ba-marble-500)', fontSize: 12, margin: 0, paddingLeft: 18, lineHeight: '1.8' }}>
              <li>Daily check-in bonus</li>
              <li>Watching rewarded ads</li>
              <li>Gold Coin package bonuses</li>
              <li>Guild contributions</li>
            </ul>
            <p style={{ color: 'var(--ba-marble-800)', fontSize: 10, margin: '10px 0 0' }}>
              NO PURCHASE NECESSARY to obtain SC. 18+ US residents only (except WA).
              Void where prohibited. See Terms for redemption details.
            </p>
          </div>
        </Section>

      </div>

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ba-accent)', color: '#fff', padding: '10px 24px',
          borderRadius: 24, fontFamily: 'monospace', fontSize: 14,
          boxShadow: '0 4px 20px var(--ba-accent-glow)', zIndex: 999,
        }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BalancePill({ gold, sc }: { gold: number; sc: number }) {
  return (
    <div className="ba-glass" style={{
      display: 'flex', gap: 10,
      borderRadius: 20, padding: '6px 14px',
    }}>
      <span style={{ color: 'var(--ba-glow-amber)', fontSize: 13 }}>🟡 {gold.toLocaleString()}</span>
      <span style={{ color: 'var(--ba-glow-teal)', fontSize: 13 }}>💎 {sc.toLocaleString()}</span>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--ba-card-border)', color: 'var(--ba-accent)',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16,
};

const actionBtnStyle: React.CSSProperties = {
  border: 'none', color: '#fff', borderRadius: 10, padding: '14px 20px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
  transition: 'opacity 0.2s',
};

const tierRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
};
