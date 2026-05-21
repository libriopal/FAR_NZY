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
import { OV, TYPE, CURRENCY, PILLAR } from '../theme/tokens.js';

// LTO: 3 rotating bundles, each active for 48h
const LTO_BUNDLES = [
  { id: 'lto_starter_boost', label: 'Starter Boost', gold: 5_000,  sc: 50,  usdCents: 499,  desc: 'Perfect for new blueprints' },
  { id: 'lto_vine_pack',     label: 'Vine Pack',     gold: 15_000, sc: 150, usdCents: 999,  desc: 'Expand your canopy fast' },
  { id: 'lto_dome_bundle',   label: 'Dome Bundle',   gold: 35_000, sc: 500, usdCents: 1999, desc: 'Full greenhouse expansion' },
] as const;

function getCurrentLtoBundleIndex() {
  return Math.floor(Date.now() / (48 * 3_600_000)) % LTO_BUNDLES.length;
}

// Shared filigree empty state
function FiligreeEmpty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {[3, 5, 8, 5, 3].map((size, i) => (
          <div key={i} style={{
            width: size, height: size,
            background: i === 2 ? OV.goldDim : 'rgba(201,168,76,0.12)',
            transform: 'rotate(45deg)',
            boxShadow: i === 2 ? `0 0 4px ${OV.goldDim}` : 'none',
          }} />
        ))}
      </div>
      <div style={{ color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode, letterSpacing: 2 }}>
        {label}
      </div>
    </div>
  );
}

export function ShopScreen() {
  const setActiveScreen        = useGameStore(s => s.setActiveScreen);
  const economyBalance         = useGameStore(s => s.economyBalance);
  const updateEconomyBalance   = useGameStore(s => s.updateEconomyBalance);
  const userId                 = useGameStore(s => s.userId);
  const { claimBattlePassTier } = useEconomy();

  const [watchingAd, setWatchingAd]   = useState(false);
  const [adCooldown, setAdCooldown]   = useState(false);
  const [toastMsg, setToastMsg]       = useState<string | null>(null);
  const [claimedTiers, setClaimedTiers] = useState<Set<number>>(new Set());

  const ltoBundle = useMemo(() => LTO_BUNDLES[getCurrentLtoBundleIndex()]!, []);
  const isFirstPurchase = economyBalance.goldCoins <= 500;

  const ltoMsLeft    = useMemo(() => { const w = 48 * 3_600_000; return w - (Date.now() % w); }, []);
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
          goldCoins:   economyBalance.goldCoins   + reward.goldCoins,
          sweepsCoins: economyBalance.sweepsCoins + reward.sweepsCoins,
          lastUpdated: Date.now(),
        });
        analytics.track({
          name: 'ad_reward_claimed',
          props: { rewardType: 'daily_free', goldCoins: reward.goldCoins, sweepsCoins: reward.sweepsCoins },
        });
        showToast(`+${reward.goldCoins} ${CURRENCY.fd.symbol} earned!`);
        setAdCooldown(true);
        setTimeout(() => setAdCooldown(false), 30_000);
      }
    } finally { setWatchingAd(false); }
  }, [watchingAd, adCooldown, economyBalance, updateEconomyBalance, showToast]);

  const handleIAP = useCallback((tierId: string, usdCents: number, gold: number) => {
    analytics.track({ name: 'purchase', props: { tierId, usdCents, goldCoins: gold } });
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
      showToast('Not enough coins.');
    }
  }, [claimedTiers, claimBattlePassTier, showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: OV.void,
      color: OV.bone, fontFamily: TYPE.fontCode, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: `1px solid ${OV.goldDim}`,
        background: 'rgba(13,0,24,0.85)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: OV.goldBright, fontFamily: TYPE.fontDisplay, letterSpacing: 2 }}>
            GOLD VAULT
          </div>
          <div style={{ color: OV.boneDim, fontSize: 10, letterSpacing: 1 }}>Fuel your blueprint expansion</div>
        </div>
        <BalancePill gold={economyBalance.goldCoins} sc={economyBalance.sweepsCoins} />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Limited-Time Offer */}
        <div style={{
          background: 'rgba(13,0,24,0.85)',
          border: `1px solid ${OV.cyanGlow}`,
          borderRadius: 10, padding: '16px 18px',
          boxShadow: `0 0 20px ${OV.cyanGlow}`,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  background: OV.cyan, color: OV.void, fontSize: 9,
                  borderRadius: 4, padding: '2px 8px', fontWeight: 700, letterSpacing: 1,
                }}>
                  LIMITED TIME
                </span>
                <span style={{ color: OV.boneDim, fontSize: 10 }}>⏰ {ltoHoursLeft}h left</span>
              </div>
              <div style={{ color: OV.bone, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{ltoBundle.label}</div>
              <div style={{ color: OV.boneDim, fontSize: 11, marginBottom: 8 }}>{ltoBundle.desc}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: OV.gold, fontSize: 13 }}>{CURRENCY.fd.symbol} {ltoBundle.gold.toLocaleString()}</span>
                <span style={{ color: OV.cyanBright, fontSize: 13 }}>+{ltoBundle.sc} {CURRENCY.pdx.symbol}</span>
              </div>
            </div>
            <button
              onClick={() => handleIAP(ltoBundle.id, ltoBundle.usdCents, ltoBundle.gold)}
              style={{
                background: OV.cyan, border: 'none', color: OV.void,
                borderRadius: 8, padding: '10px 16px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: TYPE.fontCode,
                boxShadow: `0 4px 16px ${OV.cyanGlow}`,
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
            background: adCooldown ? 'rgba(13,0,24,0.85)' : OV.gold,
            color: adCooldown ? OV.boneDim : OV.void,
            border: adCooldown ? `1px solid ${OV.goldDim}` : 'none',
            opacity: adCooldown ? 0.5 : 1,
            width: '100%',
            boxShadow: adCooldown ? 'none' : `0 0 14px ${OV.goldGlow}`,
          }}>
            {watchingAd
              ? 'Loading Ad...'
              : adCooldown
                ? '✓ Claimed — check back soon'
                : `▶ Watch Ad → +200 ${CURRENCY.fd.symbol} + 5 ${CURRENCY.pdx.symbol}`}
          </button>
          <p style={{ color: 'rgba(232,213,163,0.18)', fontSize: 10, margin: '6px 0 0', textAlign: 'center' }}>
            NO PURCHASE NECESSARY.
          </p>
        </Section>

        {/* Coin Packages */}
        <Section title={`${CURRENCY.fd.labelPlural} Packages`}>
          {DEFAULT_PRICING_TIERS.length === 0 ? (
            <FiligreeEmpty label="NO PACKAGES AVAILABLE" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEFAULT_PRICING_TIERS.map((tier, i) => {
                const showFirstBonus = isFirstPurchase && i === 0;
                return (
                  <div key={tier.id} style={{
                    ...tierRowStyle,
                    border: `1px solid ${showFirstBonus ? OV.gold : OV.cyanGlow}`,
                    boxShadow: showFirstBonus ? `0 0 10px ${OV.goldGlow}` : 'none',
                  }} onClick={() => handleIAP(tier.id, tier.usdCents, tier.goldCoins)}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 700, fontSize: 14,
                        display: 'flex', alignItems: 'center', gap: 8, color: OV.bone,
                      }}>
                        {tier.label}
                        {showFirstBonus && (
                          <span style={{
                            background: OV.gold, color: OV.void, fontSize: 8,
                            borderRadius: 4, padding: '2px 5px', fontWeight: 700,
                          }}>
                            3× FIRST PURCHASE
                          </span>
                        )}
                      </div>
                      <div style={{ color: OV.gold, fontSize: 12 }}>
                        {showFirstBonus
                          ? (tier.goldCoins * 3).toLocaleString()
                          : tier.goldCoins.toLocaleString()} {CURRENCY.fd.symbol}
                        {tier.sweepsCoinsBonus > 0 && (
                          <span style={{ color: OV.cyanBright, marginLeft: 8 }}>
                            +{tier.sweepsCoinsBonus} {CURRENCY.pdx.symbol}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: PILLAR.BIOLOGICAL.highlight }}>
                      ${(tier.usdCents / 100).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p style={{ color: 'rgba(232,213,163,0.18)', fontSize: 10, margin: '10px 0 0', textAlign: 'center' }}>
            {CURRENCY.fd.labelPlural} have no cash value. For entertainment only.
          </p>
        </Section>

        {/* Battle Pass */}
        <Section title="FAR_NZY Pass — Season 1">
          <div style={{
            background: 'rgba(13,0,24,0.85)',
            borderRadius: 10, padding: '14px 16px',
            border: `1px solid ${OV.goldDim}`,
          }}>
            <div style={{ color: OV.boneDim, fontSize: 10, marginBottom: 10, letterSpacing: 1 }}>
              10 tiers · 500 {CURRENCY.fd.symbol} each · {CURRENCY.pdx.symbol} rewards at T5 & T10
            </div>
            {BATTLE_PASS_TIERS.length === 0 ? (
              <FiligreeEmpty label="PASS NOT YET ACTIVE" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {BATTLE_PASS_TIERS.map(tierDef => {
                  const claimed   = claimedTiers.has(tierDef.tier);
                  const canAfford = economyBalance.goldCoins >= tierDef.goldCost;
                  return (
                    <div key={tierDef.tier} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 6,
                      background: claimed
                        ? 'rgba(74,222,128,0.06)'
                        : tierDef.isMilestone
                          ? `rgba(0,229,255,0.04)`
                          : 'rgba(13,0,24,0.85)',
                      border: `1px solid ${claimed ? PILLAR.BIOLOGICAL.highlight : tierDef.isMilestone ? OV.cyanGlow : OV.goldDim}`,
                    }}>
                      <span style={{ color: 'rgba(232,213,163,0.18)', fontSize: 9, minWidth: 18 }}>T{tierDef.tier}</span>
                      <span style={{
                        flex: 1, color: OV.bone, fontSize: 12,
                        fontWeight: tierDef.isMilestone ? 700 : 400,
                      }}>
                        {tierDef.label}
                        {tierDef.isMilestone && (
                          <span style={{ color: OV.cyan, fontSize: 10, marginLeft: 6 }}>★</span>
                        )}
                      </span>
                      <span style={{ color: OV.gold, fontSize: 10 }}>+{tierDef.goldReward.toLocaleString()}</span>
                      {tierDef.scReward > 0 && (
                        <span style={{ color: OV.cyanBright, fontSize: 10 }}>+{tierDef.scReward} {CURRENCY.pdx.symbol}</span>
                      )}
                      {claimed ? (
                        <span style={{ color: PILLAR.BIOLOGICAL.highlight, fontSize: 11 }}>✓</span>
                      ) : (
                        <button onClick={() => void handleBattlePassClaim(tierDef)} style={{
                          background: canAfford ? OV.cyan : 'rgba(13,0,24,0.85)',
                          border: canAfford ? 'none' : `1px solid ${OV.goldDim}`,
                          color: canAfford ? OV.void : OV.boneDim,
                          borderRadius: 4, padding: '4px 10px',
                          fontSize: 10, fontWeight: 700,
                          cursor: canAfford ? 'pointer' : 'not-allowed',
                          fontFamily: TYPE.fontCode, whiteSpace: 'nowrap',
                        }}>
                          {tierDef.goldCost}{CURRENCY.fd.symbol}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* PDX info */}
        <Section title={`${CURRENCY.pdx.labelPlural} (${CURRENCY.pdx.symbol})`}>
          <div style={{
            background: 'rgba(13,0,24,0.85)',
            borderRadius: 8, padding: 14,
            border: `1px solid ${OV.cyanGlow}`,
          }}>
            <div style={{ color: OV.cyanBright, fontSize: 12, marginBottom: 8 }}>
              {CURRENCY.pdx.labelPlural} are earned free via:
            </div>
            <ul style={{ color: OV.boneDim, fontSize: 11, margin: 0, paddingLeft: 18, lineHeight: '1.9' }}>
              <li>Daily check-in bonus</li>
              <li>Watching rewarded ads</li>
              <li>{CURRENCY.fd.labelPlural} package bonuses</li>
              <li>Guild contributions</li>
            </ul>
            <p style={{ color: 'rgba(232,213,163,0.18)', fontSize: 10, margin: '10px 0 0' }}>
              NO PURCHASE NECESSARY to obtain {CURRENCY.pdx.symbol}. 18+ US residents only (except WA).
              Void where prohibited.
            </p>
          </div>
        </Section>

      </div>

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: OV.gold, color: OV.void, padding: '10px 24px',
          borderRadius: 20, fontFamily: TYPE.fontCode, fontSize: 13,
          boxShadow: `0 4px 20px ${OV.goldGlow}`, zIndex: 999,
          fontWeight: 700, letterSpacing: 1,
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
      <div style={{ color: OV.boneDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BalancePill({ gold, sc }: { gold: number; sc: number }) {
  return (
    <div style={{
      display: 'flex', gap: 10,
      background: 'rgba(13,0,24,0.85)',
      border: `1px solid ${OV.goldDim}`,
      borderRadius: 20, padding: '6px 14px',
    }}>
      <span style={{ color: OV.gold, fontSize: 12, fontFamily: TYPE.fontCode }}>
        {CURRENCY.fd.symbol} {gold.toLocaleString()}
      </span>
      <span style={{ color: OV.cyanBright, fontSize: 12, fontFamily: TYPE.fontCode }}>
        {CURRENCY.pdx.symbol} {sc.toLocaleString()}
      </span>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${OV.goldDim}`, color: OV.gold,
  borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: TYPE.fontCode, fontSize: 16,
};

const actionBtnStyle: React.CSSProperties = {
  border: 'none', borderRadius: 8, padding: '14px 20px',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: TYPE.fontCode,
  transition: 'opacity 0.2s', letterSpacing: 1,
};

const tierRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  background: 'rgba(13,0,24,0.85)',
  borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
};
