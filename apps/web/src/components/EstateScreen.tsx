// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import type { EstateUpgrade } from '@match3d/game-core';
import { OV, TYPE, PILLAR } from '../theme/tokens.js';

export const ESTATE_UPGRADES: EstateUpgrade[] = [
  {
    id: 'greenhouse_frame',
    name: 'Greenhouse Frame',
    tier: 1,
    cost: { bioSteel: 50, aeroSeeds: 0 },
    unlocks: ['glass_panels'],
    description: 'Erect the iron lattice skeleton of the greenhouse.',
    prerequisiteIds: [],
  },
  {
    id: 'glass_panels',
    name: 'Glass Panels',
    tier: 2,
    cost: { bioSteel: 120, aeroSeeds: 20 },
    unlocks: ['bioluminescent_vines'],
    description: 'Install crystalline panes that catch morning light.',
    prerequisiteIds: ['greenhouse_frame'],
  },
  {
    id: 'bioluminescent_vines',
    name: 'Bioluminescent Vines',
    tier: 2,
    cost: { bioSteel: 0, aeroSeeds: 80 },
    unlocks: ['air_filtration'],
    description: 'Thread glowing vines through the frame — beauty and function.',
    prerequisiteIds: ['greenhouse_frame'],
  },
  {
    id: 'air_filtration',
    name: 'Aero-Filtration Layer',
    tier: 3,
    cost: { bioSteel: 200, aeroSeeds: 150 },
    unlocks: ['hydro_core'],
    description: 'A pressurized air layer keeps the estate climate-controlled.',
    prerequisiteIds: ['glass_panels', 'bioluminescent_vines'],
  },
  {
    id: 'hydro_core',
    name: 'Hydro Core',
    tier: 4,
    cost: { bioSteel: 400, aeroSeeds: 300 },
    unlocks: [],
    description: 'The living heart of the estate — a self-sustaining water cycle.',
    prerequisiteIds: ['air_filtration'],
  },
];

// Shared filigree empty state — used when content is unavailable
function FiligreeEmpty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
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

export function EstateScreen() {
  const setActiveScreen        = useGameStore(s => s.setActiveScreen);
  const resources              = useGameStore(s => s.resources);
  const purchasedUpgradeIds    = useGameStore(s => s.purchasedUpgradeIds);
  const updateResources        = useGameStore(s => s.updateResources);
  const [toast, setToast]      = useState<string | null>(null);

  const purchased = new Set(purchasedUpgradeIds);
  const allBuilt  = ESTATE_UPGRADES.every(u => purchased.has(u.id));

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const canAfford = (upgrade: EstateUpgrade) => {
    const bs  = upgrade.cost.bioSteel  ?? 0;
    const as_ = upgrade.cost.aeroSeeds ?? 0;
    return resources.bioSteel >= bs && resources.aeroSeeds >= as_;
  };

  const prereqsMet = (upgrade: EstateUpgrade) =>
    upgrade.prerequisiteIds.every(id => purchased.has(id));

  const handlePurchase = useCallback((upgrade: EstateUpgrade) => {
    if (purchased.has(upgrade.id)) return;
    if (!prereqsMet(upgrade)) { showToast('Prerequisites not met.'); return; }
    if (!canAfford(upgrade))  { showToast('Not enough resources.'); return; }
    updateResources({
      ...resources,
      bioSteel:  resources.bioSteel  - (upgrade.cost.bioSteel  ?? 0),
      aeroSeeds: resources.aeroSeeds - (upgrade.cost.aeroSeeds ?? 0),
    });
    useGameStore.setState(s => ({
      purchasedUpgradeIds: [...s.purchasedUpgradeIds, upgrade.id],
    }));
    showToast(`${upgrade.name} unlocked!`);
  }, [purchased, resources, updateResources, showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: OV.void,
      color: OV.bone, fontFamily: TYPE.fontCode, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        borderBottom: `1px solid ${OV.goldDim}`,
        background: 'rgba(13,0,24,0.85)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: OV.goldBright,
            fontFamily: TYPE.fontDisplay, letterSpacing: 2,
          }}>
            GLASS ESTATE
          </div>
          <div style={{ color: OV.boneDim, fontSize: 10, letterSpacing: 1 }}>Expand your living blueprint</div>
        </div>
      </div>

      {/* Resource bar */}
      <div style={{
        display: 'flex', gap: 20, padding: '12px 20px',
        borderBottom: `1px solid ${OV.goldDim}`,
        background: 'rgba(13,0,24,0.6)',
      }}>
        <ResBadge label="Bio-Steel"  value={resources.bioSteel}   color={OV.cyan}    />
        <ResBadge label="Aero-Seeds" value={resources.aeroSeeds}  color={PILLAR.BIOLOGICAL.highlight}    />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: OV.boneDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
          Upgrade Tree
        </div>

        {allBuilt ? (
          <FiligreeEmpty label="ALL STRUCTURES BUILT — ESTATE COMPLETE" />
        ) : (
          ESTATE_UPGRADES.map(upgrade => {
            const isPurchased = purchased.has(upgrade.id);
            const prereqOk    = prereqsMet(upgrade);
            const affordable  = canAfford(upgrade);
            const available   = prereqOk && !isPurchased;

            const borderColor = isPurchased
              ? PILLAR.BIOLOGICAL.highlight
              : available
                ? OV.cyanGlow
                : OV.goldDim;

            return (
              <div key={upgrade.id} style={{
                background: 'rgba(13,0,24,0.85)',
                border: `1px solid ${borderColor}`,
                borderRadius: 10, padding: 16,
                opacity: !prereqOk && !isPurchased ? 0.45 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: OV.bone }}>{upgrade.name}</span>
                      <span style={{
                        fontSize: 9, color: OV.boneDim,
                        background: OV.neural, borderRadius: 4, padding: '2px 6px',
                        fontFamily: TYPE.fontCode,
                      }}>
                        Tier {upgrade.tier}
                      </span>
                      {isPurchased && (
                        <span style={{ fontSize: 10, color: PILLAR.BIOLOGICAL.highlight }}>✓ Built</span>
                      )}
                    </div>
                    <div style={{ color: OV.boneDim, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                      {upgrade.description}
                    </div>
                    {!isPurchased && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        {(upgrade.cost.bioSteel ?? 0) > 0 && (
                          <CostBadge label="Steel" amount={upgrade.cost.bioSteel!}
                            color={OV.cyan} insufficient={resources.bioSteel < upgrade.cost.bioSteel!} />
                        )}
                        {(upgrade.cost.aeroSeeds ?? 0) > 0 && (
                          <CostBadge label="Seeds" amount={upgrade.cost.aeroSeeds!}
                            color={PILLAR.BIOLOGICAL.highlight} insufficient={resources.aeroSeeds < upgrade.cost.aeroSeeds!} />
                        )}
                      </div>
                    )}
                    {!prereqOk && !isPurchased && (
                      <div style={{ color: 'rgba(232,213,163,0.18)', fontSize: 11, marginTop: 6 }}>
                        Requires: {upgrade.prerequisiteIds.map(id =>
                          ESTATE_UPGRADES.find(u => u.id === id)?.name ?? id
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                  {available && (
                    <button onClick={() => handlePurchase(upgrade)} style={{
                      background: affordable ? OV.cyan : 'rgba(13,0,24,0.85)',
                      border: affordable ? 'none' : `1px solid ${OV.goldDim}`,
                      color: affordable ? OV.void : OV.boneDim,
                      borderRadius: 6, padding: '10px 16px',
                      fontSize: 12, fontWeight: 700,
                      cursor: affordable ? 'pointer' : 'not-allowed',
                      fontFamily: TYPE.fontCode, whiteSpace: 'nowrap',
                      boxShadow: affordable ? `0 0 10px ${OV.cyanGlow}` : 'none',
                    }}>
                      {affordable ? 'Build' : 'Need more'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ padding: '0 20px 32px', color: 'rgba(232,213,163,0.18)', fontSize: 10, textAlign: 'center' }}>
        Earn Bio-Steel and Aero-Seeds by matching items in gameplay.
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: OV.gold, color: OV.void, padding: '10px 24px',
          borderRadius: 20, fontFamily: TYPE.fontCode, fontSize: 13,
          boxShadow: `0 4px 20px ${OV.goldGlow}`, zIndex: 999,
          fontWeight: 700, letterSpacing: 1,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ResBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div>
        <div style={{ color, fontSize: 15, fontWeight: 700, textShadow: `0 0 6px ${color}` }}>
          {value.toLocaleString()}
        </div>
        <div style={{ color: OV.boneDim, fontSize: 10, letterSpacing: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function CostBadge({ label, amount, color, insufficient }: {
  label: string; amount: number; color: string; insufficient: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: insufficient ? OV.magenta : color,
      fontFamily: TYPE.fontCode,
    }}>
      {label}: {amount.toLocaleString()}
    </span>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${OV.goldDim}`,
  color: OV.gold,
  borderRadius: 6, padding: '6px 12px',
  cursor: 'pointer', fontFamily: TYPE.fontCode, fontSize: 16,
};
