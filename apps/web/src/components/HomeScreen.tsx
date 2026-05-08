// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { QuestPanel } from './QuestPanel.js';
import { EventBanner } from './EventBanner.js';
import { LEVELS } from '../data/levels.js';
import { setVariant, getVariant } from '../styles/variants.js';
import { VARIANTS, VARIANT_LABELS, VARIANT_ACCENT } from '../styles/tokens.js';
import type { BioVariant } from '../styles/tokens.js';

export function HomeScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const setGameMode = useGameStore(s => s.setGameMode);
  const resources = useGameStore(s => s.resources);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const setSelectedLevelId = useGameStore(s => s.setSelectedLevelId);
  const [showLevels, setShowLevels] = useState(false);
  const [currentVariant, setCurrentVariant] = useState<BioVariant>(getVariant());

  function handleVariant(v: BioVariant) {
    setVariant(v);
    setCurrentVariant(v);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: 'var(--ba-surface-bg)',
      color: 'var(--ba-marble-200)', fontFamily: 'monospace', padding: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 32 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700, margin: 0,
          background: 'linear-gradient(90deg, var(--ba-blueprint), var(--ba-glow-green), var(--ba-glow-teal))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          THE LIVING BLUEPRINT
        </h1>
        <p style={{ color: 'var(--ba-marble-500)', fontSize: 12, margin: '4px 0 0' }}>
          Glass Greenhouse Estate
        </p>
      </div>

      {/* Resource Summary */}
      <div className="ba-glass" style={{
        display: 'flex', gap: 16, marginBottom: 32,
        borderRadius: 12, padding: '12px 20px',
      }}>
        <ResourceBadge icon="⚙️" label="Bio-Steel" value={resources.bioSteel} tokenColor="var(--ba-blueprint)" />
        <ResourceBadge icon="🌱" label="Aero-Seeds" value={resources.aeroSeeds} tokenColor="var(--ba-glow-green)" />
        <ResourceBadge icon="🟡" label="Gold" value={resources.goldCoins} tokenColor="var(--ba-glow-amber)" />
        <ResourceBadge icon="💎" label="SC" value={resources.sweepsCoins} tokenColor="var(--ba-glow-teal)" />
      </div>

      {/* Live Events */}
      <div style={{ width: '100%', maxWidth: 360, marginBottom: 8 }}>
        <EventBanner />
      </div>

      {/* Quests */}
      <QuestPanel />

      {/* Main actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setGameMode('SOLO_FREE'); setActiveScreen('game'); }} style={{
            flex: 1,
            background: 'var(--ba-accent)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', borderRadius: 12, padding: '16px 24px',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
            boxShadow: '0 4px 20px var(--ba-accent-glow)',
            transition: 'opacity 0.15s ease',
          }}>
            ▶ Play
          </button>
          <button onClick={() => setShowLevels(v => !v)} className="ba-glass" style={{
            color: 'var(--ba-accent)', borderRadius: 12, padding: '16px 14px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
            border: '1px solid var(--ba-card-border)',
          }}>
            {LEVELS.find(l => l.id === selectedLevelId)?.name.split(' ')[0] ?? 'Lvl'} ▾
          </button>
        </div>

        {showLevels && (
          <div className="ba-glass" style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
            borderRadius: 10, padding: 10,
          }}>
            {LEVELS.map((lvl, i) => (
              <button key={lvl.id} onClick={() => { setSelectedLevelId(lvl.id); setShowLevels(false); }} style={{
                background: lvl.id === selectedLevelId ? 'var(--ba-accent)' : 'var(--ba-card-bg)',
                border: `1px solid ${lvl.id === selectedLevelId ? 'var(--ba-accent)' : 'var(--ba-card-border)'}`,
                color: lvl.id === selectedLevelId ? '#fff' : 'var(--ba-marble-200)',
                borderRadius: 8, padding: '8px 4px',
                fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
                textAlign: 'center', fontWeight: lvl.id === selectedLevelId ? 700 : 400,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
                <div style={{ fontSize: 9, color: 'var(--ba-marble-500)', marginTop: 2 }}>{(lvl.winScore / 1000).toFixed(0)}k</div>
              </button>
            ))}
          </div>
        )}

        <NavButton label="⚔ Multiplayer" onClick={() => setActiveScreen('multiplayer')} />
        <NavButton label="🏛 Estate" onClick={() => setActiveScreen('meta')} />
        <NavButton label="🛒 Shop" onClick={() => setActiveScreen('shop')} />
        <NavButton label="👥 Social" onClick={() => setActiveScreen('social')} />
      </div>

      {/* Variant switcher (F6) */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {VARIANTS.map(v => (
          <button key={v} onClick={() => handleVariant(v)} style={{
            background: currentVariant === v ? VARIANT_ACCENT[v] : 'var(--ba-card-bg)',
            border: `1px solid ${currentVariant === v ? VARIANT_ACCENT[v] : 'var(--ba-card-border)'}`,
            color: currentVariant === v ? '#fff' : 'var(--ba-marble-500)',
            borderRadius: 8, padding: '5px 12px',
            fontSize: 10, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
            transition: 'all 0.2s ease',
          }}>
            {VARIANT_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Sweepstakes disclaimer */}
      <p style={{ color: 'var(--ba-marble-800)', fontSize: 10, marginTop: 24, textAlign: 'center', maxWidth: 320 }}>
        NO PURCHASE NECESSARY. Sweeps Coins have no cash value. Void where prohibited.
        18+ US residents only (except WA).
      </p>
    </div>
  );
}

function ResourceBadge({ icon, label, value, tokenColor }: {
  icon: string; label: string; value: number; tokenColor: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ color: tokenColor, fontSize: 14, fontWeight: 700 }}>{value.toLocaleString()}</div>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 10 }}>{label}</div>
    </div>
  );
}

function NavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="ba-glass" style={{
      border: '1px solid var(--ba-card-border)',
      color: 'var(--ba-marble-200)', borderRadius: 12, padding: '16px 24px',
      fontSize: 16, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'monospace', textAlign: 'left',
      boxShadow: '0 4px 16px var(--ba-accent-glow)',
      transition: 'opacity 0.1s ease',
    }}>
      {label}
    </button>
  );
}
