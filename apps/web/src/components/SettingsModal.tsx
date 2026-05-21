// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// ─────────────────────────────────────────────────────

import React, { lazy, Suspense, useState } from 'react';
import { OV, TYPE, CURRENCY } from '../theme/tokens.js';

export type SettingsTab = 'THEME' | 'AUDIO' | 'SANDBOX' | 'ACCOUNT' | 'ADS';

export interface AudioSettings {
  masterVolume:   number;   // 0-1
  sfxEnabled:     boolean;
  ambientEnabled: boolean;
}

export interface SettingsModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  initialTab?:     SettingsTab;
  audioSettings?:  AudioSettings;
  onAudioChange?:  (s: AudioSettings) => void;
  kycStatus?:      'unverified' | 'pending' | 'verified';
  onKYCOpen?:      () => void;
  pdxBalance?:     number;
  fdBalance?:      number;
  playerName?:     string;
  adsEnabled?:     boolean;
}

const TABS: SettingsTab[] = ['THEME', 'AUDIO', 'SANDBOX', 'ACCOUNT', 'ADS'];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  background: active ? OV.goldDim : 'transparent',
  color: active ? OV.goldBright : OV.boneDim,
  border: active ? `1px solid ${OV.goldDim}` : '1px solid transparent',
  borderRadius: 4,
  fontWeight: 700, fontSize: 9, letterSpacing: 2,
  cursor: 'pointer', fontFamily: TYPE.fontCode,
  textShadow: active ? `0 0 6px ${OV.goldGlow}` : 'none',
});

const sectionLabel: React.CSSProperties = {
  color: OV.boneDim, fontSize: 9, letterSpacing: 3, marginBottom: 12,
  fontFamily: TYPE.fontCode, textTransform: 'uppercase',
};

function ThemeTab() {
  const [dark, setDark] = useState(
    () => document.documentElement.classList.contains('dark') ||
          !document.documentElement.classList.contains('light'),
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
      <div style={sectionLabel}>APPEARANCE</div>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        color: OV.bone, fontSize: 12, fontFamily: TYPE.fontCode,
      }}>
        <input type="checkbox" checked={dark} onChange={toggle}
          style={{ width: 16, height: 16, accentColor: OV.cyan }} />
        Dark mode
      </label>
    </div>
  );
}

function AudioTab({ settings, onChange }: { settings: AudioSettings; onChange: (s: AudioSettings) => void }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={sectionLabel}>AUDIO</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode }}>
        Master Volume
        <input type="range" min={0} max={1} step={0.05} value={settings.masterVolume}
          onChange={e => onChange({ ...settings, masterVolume: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: OV.cyan }} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: OV.bone, fontSize: 12, fontFamily: TYPE.fontCode }}>
        <input type="checkbox" checked={settings.sfxEnabled}
          onChange={e => onChange({ ...settings, sfxEnabled: e.target.checked })}
          style={{ accentColor: OV.cyan }} />
        Sound effects
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: OV.bone, fontSize: 12, fontFamily: TYPE.fontCode }}>
        <input type="checkbox" checked={settings.ambientEnabled}
          onChange={e => onChange({ ...settings, ambientEnabled: e.target.checked })}
          style={{ accentColor: OV.cyan }} />
        Ambient drone
      </label>
    </div>
  );
}

function SandboxTabInner() {
  return (
    <div style={{ padding: 16 }}>
      <div style={sectionLabel}>SANDBOX</div>
      <div style={{ color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode }}>
        Debug overlays and spawn weight controls coming soon.
      </div>
    </div>
  );
}
const SandboxTab = lazy(() => Promise.resolve<{ default: React.ComponentType }>({ default: SandboxTabInner }));

// KYC status colors follow reality duality
const KYC_COLOR: Record<'unverified' | 'pending' | 'verified', string> = {
  unverified: OV.magenta,
  pending:    OV.amberHot,
  verified:   OV.cyan,
};

function AccountTab({ kycStatus, onKYCOpen, pdxBalance, fdBalance, playerName }: {
  kycStatus?: 'unverified' | 'pending' | 'verified';
  onKYCOpen?: () => void;
  pdxBalance?: number;
  fdBalance?:  number;
  playerName?: string;
}) {
  const kycColor = KYC_COLOR[kycStatus ?? 'unverified'];
  const kycLabel = kycStatus === 'verified' ? 'Verified' : kycStatus === 'pending' ? 'Pending Review' : 'Not Verified';

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={sectionLabel}>ACCOUNT</div>
      {playerName && (
        <div style={{ color: OV.bone, fontSize: 13, fontFamily: TYPE.fontCode }}>{playerName}</div>
      )}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ fontFamily: TYPE.fontCode, fontSize: 12 }}>
          <span style={{ color: OV.boneDim }}>{CURRENCY.pdx.symbol}: </span>
          <span style={{ color: CURRENCY.pdx.particleColor, fontWeight: 700 }}>{(pdxBalance ?? 0).toLocaleString()}</span>
        </div>
        <div style={{ fontFamily: TYPE.fontCode, fontSize: 12 }}>
          <span style={{ color: OV.boneDim }}>{CURRENCY.fd.symbol}: </span>
          <span style={{ color: OV.goldBright, fontWeight: 700 }}>{(fdBalance ?? 0).toLocaleString()}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontSize: 11, color: kycColor, fontWeight: 700, fontFamily: TYPE.fontCode,
          textShadow: `0 0 6px ${kycColor}`,
        }}>
          KYC: {kycLabel}
        </div>
        {kycStatus !== 'verified' && onKYCOpen && (
          <button onClick={onKYCOpen} style={{
            padding: '3px 10px', background: OV.gold,
            color: OV.void, border: 'none', borderRadius: 4,
            fontSize: 9, cursor: 'pointer', fontFamily: TYPE.fontCode,
            fontWeight: 700, letterSpacing: 1,
          }}>
            {kycStatus === 'pending' ? 'CHECK STATUS' : 'VERIFY NOW'}
          </button>
        )}
      </div>
    </div>
  );
}

function AdsTab({ fdBalance }: { fdBalance?: number }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={sectionLabel}>ADS</div>
      <div style={{ color: OV.bone, fontSize: 12, marginBottom: 8, fontFamily: TYPE.fontCode }}>
        {CURRENCY.fd.symbol} earned via rewarded ads:{' '}
        <span style={{ color: OV.goldBright, fontWeight: 700 }}>{(fdBalance ?? 0).toLocaleString()}</span>
      </div>
      <div style={{ color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode }}>
        Rewarded ad preferences managed here.
      </div>
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
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'rgba(5,0,18,0.97)',
        border: `1px solid ${OV.goldDim}`,
        borderTop: `2px solid ${OV.gold}`,
        borderRadius: 8, width: '90%', maxWidth: 480, maxHeight: '80dvh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: `0 0 40px rgba(201,168,76,0.08)`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: `1px solid ${OV.goldDim}`,
        }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {visibleTabs.map(t => (
              <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: OV.boneDim,
            fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
          }}>
            &#x2715;
          </button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'THEME'   && <ThemeTab />}
          {tab === 'AUDIO'   && <AudioTab settings={audio} onChange={onAudioChange ?? (() => {})} />}
          {tab === 'SANDBOX' && (
            <Suspense fallback={
              <div style={{ padding: 16, color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode }}>
                Loading…
              </div>
            }>
              <SandboxTab />
            </Suspense>
          )}
          {tab === 'ACCOUNT' && (
            <AccountTab
              {...(kycStatus   !== undefined ? { kycStatus   } : {})}
              {...(onKYCOpen   !== undefined ? { onKYCOpen   } : {})}
              {...(pdxBalance  !== undefined ? { pdxBalance  } : {})}
              {...(fdBalance   !== undefined ? { fdBalance   } : {})}
              {...(playerName  !== undefined ? { playerName  } : {})}
            />
          )}
          {tab === 'ADS' && adsEnabled && (
            <AdsTab {...(fdBalance !== undefined ? { fdBalance } : {})} />
          )}
        </div>
      </div>
    </div>
  );
}
