// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { createAgeGateStateMachine, ComplianceService } from '@match3d/compliance';
import type { AgeGateState, ComplianceProfile } from '@match3d/compliance';
import { useGameStore } from '../store/gameStore.js';
import { analytics } from '@match3d/analytics';
import { savePlayerData } from '@match3d/backend-client';

const machine = createAgeGateStateMachine(18);

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export function AgeGate() {
  const [state, setState] = useState<AgeGateState>(machine.getInitialState());
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [termsChecked, setTermsChecked] = useState(false);

  const setComplianceApproved = useGameStore(s => s.setComplianceApproved);
  const setActiveScreen = useGameStore(s => s.setActiveScreen);

  const handleAgeSubmit = () => {
    const next = machine.advance({ ...state, step: 'age_input' }, {
      birthYear: parseInt(birthYear),
      birthMonth: parseInt(birthMonth),
      birthDay: parseInt(birthDay),
    });
    setState(next);
    if (next.step === 'denied') {
      analytics.track({ name: 'compliance_denied', props: { reason: 'age' } });
    }
  };

  const handleStateSubmit = () => {
    const next = machine.advance({ ...state, step: 'state_select' }, { state: selectedState });
    setState(next);
    if (next.step === 'denied') {
      analytics.track({ name: 'compliance_denied', props: { reason: 'state', state: selectedState } });
    }
  };

  const handleTermsSubmit = async () => {
    const next = machine.advance({ ...state, step: 'terms' }, { termsAccepted: termsChecked });
    if (next.step === 'approved') {
      const profile = next.profile as ComplianceProfile;
      setComplianceApproved(profile);
      sessionStorage.setItem('compliance_approved', '1');
      setActiveScreen('home');
      const userId = useGameStore.getState().userId;
      if (userId) {
        const svc = new ComplianceService();
        const flags = svc.buildComplianceFlags(profile);
        try {
          await savePlayerData(userId, {
            compliance_flags: flags as unknown as Record<string, unknown>,
          });
        } catch { /* non-critical */ }
      }
    }
    setState(next);
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0a1628', color: '#7ecfff', fontFamily: 'monospace',
    padding: 24,
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,32,64,0.9)', borderRadius: 16, border: '1px solid #1a4060',
    padding: 32, maxWidth: 420, width: '100%', textAlign: 'center',
    boxShadow: '0 0 40px rgba(62,160,255,0.15)',
  };

  const inputStyle: React.CSSProperties = {
    background: '#0a1628', border: '1px solid #1a4060', color: '#7ecfff',
    borderRadius: 8, padding: '10px 14px', fontSize: 16, width: '100%',
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
    fontFamily: 'monospace',
  };

  const btnStyle: React.CSSProperties = {
    background: '#1a6fd4', border: 'none', color: '#fff', borderRadius: 8,
    padding: '12px 32px', fontSize: 16, cursor: 'pointer', fontFamily: 'monospace',
    fontWeight: 700, width: '100%', marginTop: 8,
    boxShadow: '0 0 12px rgba(26,111,212,0.4)',
  };

  if (state.step === 'entry' || state.step === 'age_input') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌿 The Living Blueprint</div>
          <p style={{ color: '#4a8a9a', marginBottom: 24, fontSize: 14 }}>
            Please verify your age to continue. This game is for adults 18+.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, width: '33%' }} placeholder="MM" maxLength={2}
              value={birthMonth} onChange={e => setBirthMonth(e.target.value)} />
            <input style={{ ...inputStyle, width: '33%' }} placeholder="DD" maxLength={2}
              value={birthDay} onChange={e => setBirthDay(e.target.value)} />
            <input style={{ ...inputStyle, width: '34%' }} placeholder="YYYY" maxLength={4}
              value={birthYear} onChange={e => setBirthYear(e.target.value)} />
          </div>
          <button style={btnStyle} onClick={handleAgeSubmit}>Continue</button>
          <p style={{ color: '#1a4060', fontSize: 11, marginTop: 16 }}>
            NO PURCHASE NECESSARY. Sweepstakes void in WA and where prohibited.
          </p>
        </div>
      </div>
    );
  }

  if (state.step === 'state_select') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, marginBottom: 16 }}>Select Your State</div>
          <select style={{ ...inputStyle, marginBottom: 16 }}
            value={selectedState} onChange={e => setSelectedState(e.target.value)}>
            <option value="">-- Select State --</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={btnStyle} onClick={handleStateSubmit} disabled={!selectedState}>Continue</button>
        </div>
      </div>
    );
  }

  if (state.step === 'terms') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, marginBottom: 16 }}>Terms & Sweepstakes Rules</div>
          <div style={{
            background: '#060f1e', borderRadius: 8, padding: 16, maxHeight: 180,
            overflowY: 'auto', textAlign: 'left', fontSize: 12, color: '#4a8a9a',
            marginBottom: 16, lineHeight: 1.6,
          }}>
            <strong style={{ color: '#7ecfff' }}>NO PURCHASE NECESSARY.</strong> A purchase does not improve your
            chances of winning. Open to legal residents of the United States (except WA), 18+.
            Void where prohibited. Sweeps Coins have no monetary value and cannot be redeemed
            for cash. Gold Coins are virtual currency only. By participating, you agree to the
            Official Rules and Privacy Policy. For free entry, see alternate method of entry in
            Official Rules. Sponsor: [Company Name], [Address].
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            color: '#7ecfff', fontSize: 14, textAlign: 'left', marginBottom: 16 }}>
            <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)}
              style={{ width: 18, height: 18 }} />
            I am 18+ and agree to the Terms, Privacy Policy, and Sweepstakes Official Rules.
          </label>
          <button style={{ ...btnStyle, opacity: termsChecked ? 1 : 0.5 }}
            onClick={handleTermsSubmit} disabled={!termsChecked}>
            Enter the Greenhouse
          </button>
        </div>
      </div>
    );
  }

  if (state.step === 'denied') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, color: '#ff6060', marginBottom: 12 }}>Access Restricted</div>
          <p style={{ color: '#4a8a9a', fontSize: 14 }}>{state.denialReason}</p>
          <p style={{ color: '#1a4060', fontSize: 12, marginTop: 16 }}>
            This sweepstakes is not available in your region or to users under 18.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
