// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// ─────────────────────────────────────────────────────

import React, { lazy, Suspense, useState } from 'react';

export type SettingsTab = 'THEME' | 'AUDIO' | 'SANDBOX' | 'ACCOUNT' | 'ADS';

export interface AudioSettings {
  masterVolume: number;   // 0-1
  sfxEnabled: boolean;
  ambientEnabled: boolean;
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  audioSettings?: AudioSettings;
  onAudioChange?: (s: AudioSettings) => void;
  kycStatus?: 'unverified' | 'pending' | 'verified';
  onKYCOpen?: () => void;
  pdxBalance?: number;
  fdBalance?: number;
  playerName?: string;
  adsEnabled?: boolean;
}

const TABS: SettingsTab[] = ['THEME', 'AUDIO', 'SANDBOX', 'ACCOUNT', 'ADS'];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  background: active ? '#4f46e5' : 'transparent',
  color: active ? '#fff' : '#a78bfa',
  border: 'none',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 1,
  cursor: 'pointer',
});

function ThemeTab() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light'),
  );
  const toggle = () => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      document.documentElement.classList.toggle('light', !next);
      return next;
    });
  };
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: '#a78bfa', fontSize: 11, marginBottom: 12, letterSpacing: 1 }}>APPEARANCE</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={dark} onChange={toggle} style={{ width: 16, height: 16 }} />
        Dark mode
      </label>
    </div>
  );
}

function AudioTab({ settings, onChange }: { settings: AudioSettings; onChange: (s: AudioSettings) => void }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 1 }}>AUDIO</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#e2e8f0', fontSize: 12 }}>
        Master Volume
        <input type="range" min={0} max={1} step={0.05} value={settings.masterVolume}
          onChange={e => onChange({ ...settings, masterVolume: parseFloat(e.target.value) })}
          style={{ width: '100%' }} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: 12 }}>
        <input type="checkbox" checked={settings.sfxEnabled}
          onChange={e => onChange({ ...settings, sfxEnabled: e.target.checked })} />
        Sound effects
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#e2e8f0', fontSize: 12 }}>
        <input type="checkbox" checked={settings.ambientEnabled}
          onChange={e => onChange({ ...settings, ambientEnabled: e.target.checked })} />
        Ambient drone
      </label>
    </div>
  );
}

function SandboxTabInner() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>SANDBOX</div>
      <div style={{ color: '#64748b', fontSize: 12 }}>Debug overlays and spawn weight controls coming soon.</div>
    </div>
  );
}
const SandboxTab = lazy(() => Promise.resolve<{ default: React.ComponentType }>({ default: SandboxTabInner }));

function AccountTab({ kycStatus, onKYCOpen, pdxBalance, fdBalance, playerName }: {
  kycStatus?: 'unverified' | 'pending' | 'verified';
  onKYCOpen?: () => void;
  pdxBalance?: number;
  fdBalance?: number;
  playerName?: string;
}) {
  const statusColor = kycStatus === 'verified' ? '#10b981' : kycStatus === 'pending' ? '#f59e0b' : '#ef4444';
  const statusLabel = kycStatus === 'verified' ? 'Verified' : kycStatus === 'pending' ? 'Pending Review' : 'Not Verified';
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 1 }}>ACCOUNT</div>
      {playerName && <div style={{ color: '#e2e8f0', fontSize: 13 }}>{playerName}</div>}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ color: '#7c3aed', fontSize: 12 }}>PDX: <span style={{ color: '#a78bfa', fontWeight: 700 }}>{(pdxBalance ?? 0).toLocaleString()}</span></div>
        <div style={{ color: '#059669', fontSize: 12 }}>FD: <span style={{ color: '#34d399', fontWeight: 700 }}>{(fdBalance ?? 0).toLocaleString()}</span></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>KYC: {statusLabel}</div>
        {kycStatus !== 'verified' && onKYCOpen && (
          <button onClick={onKYCOpen} style={{ padding: '3px 8px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>
            {kycStatus === 'pending' ? 'Check Status' : 'Verify Now'}
          </button>
        )}
      </div>
    </div>
  );
}

function AdsTab({ fdBalance }: { fdBalance?: number }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>ADS</div>
      <div style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 8 }}>
        FD earned via rewarded ads: <span style={{ color: '#34d399', fontWeight: 700 }}>{(fdBalance ?? 0).toLocaleString()}</span>
      </div>
      <div style={{ color: '#64748b', fontSize: 11 }}>Rewarded ad preferences managed here.</div>
    </div>
  );
}

export function SettingsModal({
  isOpen, onClose, initialTab = 'THEME',
  audioSettings, onAudioChange,
  kycStatus, onKYCOpen, pdxBalance, fdBalance, playerName,
  adsEnabled = false,
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const defaultAudio: AudioSettings = { masterVolume: 0.7, sfxEnabled: true, ambientEnabled: true };
  const audio = audioSettings ?? defaultAudio;

  const visibleTabs = TABS.filter(t => t !== 'ADS' || adsEnabled);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0f0a1e', border: '1px solid #4f46e5', borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: '80dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1e1b4b' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {visibleTabs.map(t => (
              <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>&#x2715;</button>
        </div>
        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'THEME' && <ThemeTab />}
          {tab === 'AUDIO' && <AudioTab settings={audio} onChange={onAudioChange ?? (() => {})} />}
          {tab === 'SANDBOX' && <Suspense fallback={<div style={{ padding: 16, color: '#64748b', fontSize: 12 }}>Loading...</div>}><SandboxTab /></Suspense>}
          {tab === 'ACCOUNT' && <AccountTab {...(kycStatus !== undefined ? { kycStatus } : {})} {...(onKYCOpen !== undefined ? { onKYCOpen } : {})} {...(pdxBalance !== undefined ? { pdxBalance } : {})} {...(fdBalance !== undefined ? { fdBalance } : {})} {...(playerName !== undefined ? { playerName } : {})} />}
          {tab === 'ADS' && adsEnabled && <AdsTab {...(fdBalance !== undefined ? { fdBalance } : {})} />}
        </div>
      </div>
    </div>
  );
}
