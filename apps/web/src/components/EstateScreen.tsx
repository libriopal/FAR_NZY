import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import type { EstateUpgrade } from '@match3d/game-core';

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

export function EstateScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const resources = useGameStore(s => s.resources);
  const purchasedUpgradeIds = useGameStore(s => s.purchasedUpgradeIds);
  const updateResources = useGameStore(s => s.updateResources);
  const [toast, setToast] = useState<string | null>(null);

  const purchased = new Set(purchasedUpgradeIds);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const canAfford = (upgrade: EstateUpgrade) => {
    const bs = upgrade.cost.bioSteel ?? 0;
    const as_ = upgrade.cost.aeroSeeds ?? 0;
    return resources.bioSteel >= bs && resources.aeroSeeds >= as_;
  };

  const prereqsMet = (upgrade: EstateUpgrade) =>
    upgrade.prerequisiteIds.every(id => purchased.has(id));

  const handlePurchase = useCallback((upgrade: EstateUpgrade) => {
    if (purchased.has(upgrade.id)) return;
    if (!prereqsMet(upgrade)) { showToast('Prerequisites not met.'); return; }
    if (!canAfford(upgrade)) { showToast('Not enough resources.'); return; }
    updateResources({
      ...resources,
      bioSteel: resources.bioSteel - (upgrade.cost.bioSteel ?? 0),
      aeroSeeds: resources.aeroSeeds - (upgrade.cost.aeroSeeds ?? 0),
    });
    // Persist purchased ids — shallow update via store for now
    // In production this goes through server-authoritative economy
    useGameStore.setState(s => ({
      purchasedUpgradeIds: [...s.purchasedUpgradeIds, upgrade.id],
    }));
    showToast(`${upgrade.name} unlocked!`);
  }, [purchased, resources, updateResources, showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a1f0a 0%, #0a1628 100%)',
      color: '#5de58a', fontFamily: 'monospace', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid #1a3a1a',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Glass Greenhouse Estate</div>
          <div style={{ color: '#1a4a1a', fontSize: 11 }}>Expand your living blueprint</div>
        </div>
      </div>

      {/* Resource bar */}
      <div style={{
        display: 'flex', gap: 20, padding: '12px 20px',
        background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid #1a3a1a',
      }}>
        <ResBadge icon="⚙️" label="Bio-Steel" value={resources.bioSteel} color="#7ecfff" />
        <ResBadge icon="🌱" label="Aero-Seeds" value={resources.aeroSeeds} color="#5de58a" />
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#1a4a1a', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Upgrade Tree
        </div>

        {ESTATE_UPGRADES.map(upgrade => {
          const isPurchased = purchased.has(upgrade.id);
          const prereqOk = prereqsMet(upgrade);
          const affordable = canAfford(upgrade);
          const available = prereqOk && !isPurchased;

          return (
            <div key={upgrade.id} style={{
              background: isPurchased
                ? 'rgba(93,229,138,0.08)'
                : available && affordable
                  ? 'rgba(13,42,20,0.8)'
                  : 'rgba(10,26,10,0.4)',
              border: `1px solid ${isPurchased ? '#2a6a3a' : available ? '#1a4a2a' : '#0a2a0a'}`,
              borderRadius: 12, padding: 16,
              opacity: !prereqOk && !isPurchased ? 0.45 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{upgrade.name}</span>
                    <span style={{
                      fontSize: 10, color: '#1a4a1a',
                      background: '#0a1f0a', borderRadius: 4, padding: '2px 6px',
                    }}>
                      Tier {upgrade.tier}
                    </span>
                    {isPurchased && (
                      <span style={{ fontSize: 10, color: '#5de58a' }}>✓ Built</span>
                    )}
                  </div>
                  <div style={{ color: '#2a6a3a', fontSize: 12, marginTop: 4 }}>
                    {upgrade.description}
                  </div>
                  {!isPurchased && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      {(upgrade.cost.bioSteel ?? 0) > 0 && (
                        <CostBadge icon="⚙️" amount={upgrade.cost.bioSteel!} color="#7ecfff"
                          insufficient={resources.bioSteel < upgrade.cost.bioSteel!} />
                      )}
                      {(upgrade.cost.aeroSeeds ?? 0) > 0 && (
                        <CostBadge icon="🌱" amount={upgrade.cost.aeroSeeds!} color="#5de58a"
                          insufficient={resources.aeroSeeds < upgrade.cost.aeroSeeds!} />
                      )}
                    </div>
                  )}
                  {!prereqOk && !isPurchased && (
                    <div style={{ color: '#1a3a1a', fontSize: 11, marginTop: 6 }}>
                      Requires: {upgrade.prerequisiteIds.map(id =>
                        ESTATE_UPGRADES.find(u => u.id === id)?.name ?? id
                      ).join(', ')}
                    </div>
                  )}
                </div>
                {available && (
                  <button onClick={() => handlePurchase(upgrade)} style={{
                    background: affordable ? '#1a6fd4' : '#1a1a2a',
                    border: 'none', color: affordable ? '#fff' : '#2a2a4a',
                    borderRadius: 8, padding: '10px 18px',
                    fontSize: 13, fontWeight: 700, cursor: affordable ? 'pointer' : 'not-allowed',
                    fontFamily: 'monospace', whiteSpace: 'nowrap',
                  }}>
                    {affordable ? 'Build' : 'Need more'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '0 20px 32px', color: '#0a2a0a', fontSize: 11, textAlign: 'center' }}>
        Earn Bio-Steel and Aero-Seeds by matching items in gameplay.
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#1a6fd4', color: '#fff', padding: '10px 24px',
          borderRadius: 24, fontFamily: 'monospace', fontSize: 14,
          boxShadow: '0 4px 20px rgba(26,111,212,0.5)', zIndex: 999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ResBadge({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div>
        <div style={{ color, fontSize: 15, fontWeight: 700 }}>{value.toLocaleString()}</div>
        <div style={{ color: '#1a3a1a', fontSize: 10 }}>{label}</div>
      </div>
    </div>
  );
}

function CostBadge({ icon, amount, color, insufficient }: {
  icon: string; amount: number; color: string; insufficient: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: insufficient ? '#ff6060' : color,
    }}>
      {icon} {amount.toLocaleString()}
    </span>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #1a3a1a', color: '#5de58a',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16,
};
