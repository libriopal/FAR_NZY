import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { QuestPanel } from './QuestPanel.js';
import { EventBanner } from './EventBanner.js';
import { LEVELS } from '../data/levels.js';

export function HomeScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const resources = useGameStore(s => s.resources);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const setSelectedLevelId = useGameStore(s => s.setSelectedLevelId);
  const [showLevels, setShowLevels] = useState(false);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: 'linear-gradient(180deg, #0a1628 0%, #0d2a14 100%)',
      color: '#7ecfff', fontFamily: 'monospace', padding: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0,
          background: 'linear-gradient(90deg, #7ecfff, #5de58a, #d4a0ff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          THE LIVING BLUEPRINT
        </h1>
        <p style={{ color: '#4a8a9a', fontSize: 12, margin: '4px 0 0' }}>
          Glass Greenhouse Estate
        </p>
      </div>

      {/* Resource Summary */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 32,
        background: 'rgba(13,32,64,0.8)', borderRadius: 12,
        padding: '12px 20px', border: '1px solid #1a4060',
      }}>
        <ResourceBadge icon="⚙️" label="Bio-Steel" value={resources.bioSteel} color="#7ecfff" />
        <ResourceBadge icon="🌱" label="Aero-Seeds" value={resources.aeroSeeds} color="#5de58a" />
        <ResourceBadge icon="🟡" label="Gold" value={resources.goldCoins} color="#ffd700" />
        <ResourceBadge icon="💎" label="SC" value={resources.sweepsCoins} color="#00e5ff" />
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
          <button onClick={() => setActiveScreen('game')} style={{
            flex: 1, background: '#1a6fd4', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', borderRadius: 12, padding: '16px 24px',
            fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
            boxShadow: '0 4px 20px #1a6fd440',
          }}>
            ▶ Play
          </button>
          <button onClick={() => setShowLevels(v => !v)} style={{
            background: '#0d2a50', border: '1px solid #1a4060',
            color: '#7ecfff', borderRadius: 12, padding: '16px 14px',
            fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
          }}>
            {LEVELS.find(l => l.id === selectedLevelId)?.name.split(' ')[0] ?? 'Lvl'} ▾
          </button>
        </div>
        {showLevels && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6,
            background: 'rgba(10,22,40,0.95)', borderRadius: 10,
            border: '1px solid #1a4060', padding: 10,
          }}>
            {LEVELS.map((lvl, i) => (
              <button key={lvl.id} onClick={() => { setSelectedLevelId(lvl.id); setShowLevels(false); }} style={{
                background: lvl.id === selectedLevelId ? '#1a6fd4' : '#0d2040',
                border: `1px solid ${lvl.id === selectedLevelId ? '#3a8fed' : '#1a3060'}`,
                color: '#7ecfff', borderRadius: 8, padding: '8px 4px',
                fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
                textAlign: 'center', fontWeight: lvl.id === selectedLevelId ? 700 : 400,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
                <div style={{ fontSize: 9, color: '#4a8aaa', marginTop: 2 }}>{(lvl.winScore / 1000).toFixed(0)}k</div>
              </button>
            ))}
          </div>
        )}

        <NavButton label="⚔ Multiplayer" color="#1a3a6a" onClick={() => setActiveScreen('multiplayer')} />
        <NavButton label="🏛 Estate" color="#2a4a2a" onClick={() => setActiveScreen('meta')} />
        <NavButton label="🛒 Shop" color="#4a2a00" onClick={() => setActiveScreen('shop')} />
        <NavButton label="👥 Social" color="#2a1a4a" onClick={() => setActiveScreen('social')} />
      </div>

      {/* Sweepstakes disclaimer */}
      <p style={{ color: '#1a3050', fontSize: 10, marginTop: 40, textAlign: 'center', maxWidth: 320 }}>
        NO PURCHASE NECESSARY. Sweeps Coins have no cash value. Void where prohibited.
        18+ US residents only (except WA).
      </p>
    </div>
  );
}

function ResourceBadge({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ color, fontSize: 14, fontWeight: 700 }}>{value.toLocaleString()}</div>
      <div style={{ color: '#1a4060', fontSize: 10 }}>{label}</div>
    </div>
  );
}

function NavButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: color, border: '1px solid rgba(255,255,255,0.1)',
      color: '#ffffff', borderRadius: 12, padding: '16px 24px',
      fontSize: 16, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'monospace', textAlign: 'left',
      boxShadow: `0 4px 20px ${color}40`,
      transition: 'transform 0.1s ease',
    }}>
      {label}
    </button>
  );
}
