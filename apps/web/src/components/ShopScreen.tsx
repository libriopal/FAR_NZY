import React, { useState, useCallback, useMemo } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { DEFAULT_PRICING_TIERS, AD_REWARD_AMOUNTS } from '@match3d/economy';
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

  const [watchingAd, setWatchingAd] = useState(false);
  const [adCooldown, setAdCooldown] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0a00 0%, #0a1628 100%)',
      color: '#ffd700', fontFamily: 'monospace', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid #2a1a00',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Gold Vault</div>
          <div style={{ color: '#4a3a00', fontSize: 11 }}>Fuel your blueprint expansion</div>
        </div>
        <BalancePill gold={economyBalance.goldCoins} sc={economyBalance.sweepsCoins} />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Limited-Time Offer Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0a30, #0d2040)',
          border: '1px solid #7c3aed',
          borderRadius: 14, padding: '16px 18px',
          boxShadow: '0 0 20px rgba(124,58,237,0.25)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>
                  LIMITED TIME
                </span>
                <span style={{ color: '#a78bfa', fontSize: 11 }}>⏰ {ltoHoursLeft}h left</span>
              </div>
              <div style={{ color: '#e9d5ff', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{ltoBundle.label}</div>
              <div style={{ color: '#6d28d9', fontSize: 11, marginBottom: 8 }}>{ltoBundle.desc}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: '#ffd700', fontSize: 13 }}>🟡 {ltoBundle.gold.toLocaleString()}</span>
                <span style={{ color: '#00e5ff', fontSize: 13 }}>💎 +{ltoBundle.sc} SC</span>
              </div>
            </div>
            <button
              onClick={() => handleIAP(ltoBundle.id, ltoBundle.usdCents, ltoBundle.gold)}
              style={{
                background: '#7c3aed', border: 'none', color: '#fff',
                borderRadius: 10, padding: '10px 16px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                boxShadow: '0 4px 16px rgba(124,58,237,0.5)',
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
            background: adCooldown ? '#1a1a1a' : '#1a6fd4',
            opacity: adCooldown ? 0.5 : 1,
            width: '100%',
          }}>
            {watchingAd ? 'Loading Ad...' : adCooldown ? '✓ Claimed — check back soon' : '▶ Watch Ad → +200 Gold + 5 SC'}
          </button>
          <p style={{ color: '#1a3050', fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>
            NO PURCHASE NECESSARY. Ad reward available once every 30 seconds in dev.
          </p>
        </Section>

        {/* Gold Coin Packages */}
        <Section title="Gold Coin Packages">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEFAULT_PRICING_TIERS.map((tier, i) => {
              const showFirstBonus = isFirstPurchase && i === 0;
              return (
                <div key={tier.id} style={{
                  ...tierRowStyle,
                  border: `1px solid ${showFirstBonus ? '#ffd700' : '#2a1a00'}`,
                  boxShadow: showFirstBonus ? '0 0 10px rgba(255,215,0,0.2)' : 'none',
                }} onClick={() => handleIAP(tier.id, tier.usdCents, tier.goldCoins)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tier.label}
                      {showFirstBonus && (
                        <span style={{ background: '#ffd700', color: '#1a0a00', fontSize: 9, borderRadius: 4, padding: '2px 5px', fontWeight: 700 }}>
                          3× FIRST PURCHASE
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#ffd700', fontSize: 13 }}>
                      {showFirstBonus ? (tier.goldCoins * 3).toLocaleString() : tier.goldCoins.toLocaleString()} Gold
                      {tier.sweepsCoinsBonus > 0 && (
                        <span style={{ color: '#00e5ff', marginLeft: 8 }}>+{tier.sweepsCoinsBonus} SC</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#5de58a' }}>
                    ${(tier.usdCents / 100).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ color: '#1a3050', fontSize: 10, margin: '10px 0 0', textAlign: 'center' }}>
            Gold Coins have no cash value. For entertainment only.
          </p>
        </Section>

        {/* Sweeps Coins info */}
        <Section title="Sweeps Coins (SC)">
          <div style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid #003a4a', borderRadius: 10, padding: 14 }}>
            <div style={{ color: '#00e5ff', fontSize: 13, marginBottom: 8 }}>
              Sweeps Coins are earned free via:
            </div>
            <ul style={{ color: '#4a8a9a', fontSize: 12, margin: 0, paddingLeft: 18, lineHeight: '1.8' }}>
              <li>Daily check-in bonus</li>
              <li>Watching rewarded ads</li>
              <li>Gold Coin package bonuses</li>
              <li>Guild contributions</li>
            </ul>
            <p style={{ color: '#1a3050', fontSize: 10, margin: '10px 0 0' }}>
              NO PURCHASE NECESSARY to obtain SC. 18+ US residents only (except WA).
              Void where prohibited. See Terms for redemption details.
            </p>
          </div>
        </Section>

      </div>

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#1a6fd4', color: '#fff', padding: '10px 24px',
          borderRadius: 24, fontFamily: 'monospace', fontSize: 14,
          boxShadow: '0 4px 20px rgba(26,111,212,0.6)', zIndex: 999,
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
      <div style={{ color: '#4a3a00', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BalancePill({ gold, sc }: { gold: number; sc: number }) {
  return (
    <div style={{
      display: 'flex', gap: 10, background: 'rgba(0,0,0,0.4)',
      border: '1px solid #2a1a00', borderRadius: 20, padding: '6px 14px',
    }}>
      <span style={{ color: '#ffd700', fontSize: 13 }}>🟡 {gold.toLocaleString()}</span>
      <span style={{ color: '#00e5ff', fontSize: 13 }}>💎 {sc.toLocaleString()}</span>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2a1a00', color: '#ffd700',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16,
};

const actionBtnStyle: React.CSSProperties = {
  border: 'none', color: '#fff', borderRadius: 10, padding: '14px 20px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
  transition: 'opacity 0.2s',
};

const tierRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  background: 'rgba(42,26,0,0.6)', border: '1px solid #2a1a00',
  borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
};
