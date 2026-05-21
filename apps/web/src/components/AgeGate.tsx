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
import { OV, TYPE } from '../theme/tokens.js';

const machine = createAgeGateStateMachine(18);

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', background: OV.void, fontFamily: TYPE.fontCode,
  padding: 24,
  backgroundImage: `radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.06) 0%, transparent 60%)`,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(5,0,18,0.96)',
  borderRadius: 8,
  border: `1px solid ${OV.goldDim}`,
  borderTop: `2px solid ${OV.gold}`,
  padding: 32, maxWidth: 420, width: '100%', textAlign: 'center',
  boxShadow: `0 0 40px rgba(201,168,76,0.1)`,
};

const inputStyle: React.CSSProperties = {
  background: OV.neural,
  border: `1px solid ${OV.goldDim}`,
  color: OV.bone,
  borderRadius: 6, padding: '10px 14px', fontSize: 14, width: '100%',
  outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  fontFamily: TYPE.fontCode,
};

const btnStyle: React.CSSProperties = {
  background: OV.cyan,
  border: 'none',
  color: OV.void,
  borderRadius: 6,
  padding: '12px 32px', fontSize: 14, cursor: 'pointer',
  fontFamily: TYPE.fontCode, fontWeight: 700, width: '100%', marginTop: 8,
  letterSpacing: 2,
  boxShadow: `0 0 12px ${OV.cyanGlow}`,
};

function FiligreeHead() {
  const mid = 4;
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      {[3, 5, 3, 8, 3, 5, 3].map((size, i) => (
        <div key={i} style={{
          width: size, height: size, background: i === mid ? OV.gold : OV.goldDim,
          transform: 'rotate(45deg)',
          boxShadow: i === mid ? `0 0 6px ${OV.goldGlow}` : 'none',
        }} />
      ))}
    </div>
  );
}

export function AgeGate() {
  const [state, setState] = useState<AgeGateState>(machine.getInitialState());
  const [birthYear, setBirthYear]   = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]     = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [termsChecked, setTermsChecked]   = useState(false);

  const setComplianceApproved = useGameStore(s => s.setComplianceApproved);
  const setActiveScreen       = useGameStore(s => s.setActiveScreen);

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

  if (state.step === 'entry' || state.step === 'age_input') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <FiligreeHead />
          <div style={{
            color: OV.goldBright, fontSize: 18, fontWeight: 700, letterSpacing: 3,
            fontFamily: TYPE.fontDisplay, marginBottom: 6,
          }}>
            FARKLE FRENZY
          </div>
          <p style={{ color: OV.boneDim, marginBottom: 24, fontSize: 12, letterSpacing: 1 }}>
            Verify your age to access the signal. 18+ only.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, width: '33%' }} placeholder="MM" maxLength={2}
              value={birthMonth} onChange={e => setBirthMonth(e.target.value)} />
            <input style={{ ...inputStyle, width: '33%' }} placeholder="DD" maxLength={2}
              value={birthDay} onChange={e => setBirthDay(e.target.value)} />
            <input style={{ ...inputStyle, width: '34%' }} placeholder="YYYY" maxLength={4}
              value={birthYear} onChange={e => setBirthYear(e.target.value)} />
          </div>
          <button style={btnStyle} onClick={handleAgeSubmit}>CONTINUE →</button>
          <p style={{ color: OV.goldDim, fontSize: 10, marginTop: 16, letterSpacing: 1 }}>
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
          <FiligreeHead />
          <div style={{ color: OV.bone, fontSize: 15, marginBottom: 16, letterSpacing: 2 }}>
            SELECT YOUR STATE
          </div>
          <select
            style={{ ...inputStyle, marginBottom: 16 }}
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
          >
            <option value="">-- Select State --</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={{ ...btnStyle, opacity: selectedState ? 1 : 0.4 }}
            onClick={handleStateSubmit} disabled={!selectedState}>
            CONTINUE →
          </button>
        </div>
      </div>
    );
  }

  if (state.step === 'terms') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <FiligreeHead />
          <div style={{ color: OV.bone, fontSize: 15, marginBottom: 16, letterSpacing: 2 }}>
            TERMS & SWEEPSTAKES RULES
          </div>
          <div style={{
            background: OV.neural, borderRadius: 6, padding: 14, maxHeight: 180,
            overflowY: 'auto', textAlign: 'left', fontSize: 11,
            color: OV.boneDim, marginBottom: 16, lineHeight: 1.7,
            border: `1px solid ${OV.goldDim}`,
          }}>
            <strong style={{ color: OV.bone }}>NO PURCHASE NECESSARY.</strong> A purchase does not
            improve your chances of winning. Open to legal residents of the United States (except WA), 18+.
            Void where prohibited. Sweeps Coins have no monetary value and cannot be redeemed
            for cash. Gold Coins are virtual currency only. By participating, you agree to the
            Official Rules and Privacy Policy. For free entry, see alternate method of entry in
            Official Rules. Sponsor: [Company Name], [Address].
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            color: OV.bone, fontSize: 13, textAlign: 'left', marginBottom: 16,
          }}>
            <input type="checkbox" checked={termsChecked}
              onChange={e => setTermsChecked(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: OV.cyan }} />
            I am 18+ and agree to the Terms, Privacy Policy, and Sweepstakes Official Rules.
          </label>
          <button
            style={{ ...btnStyle, opacity: termsChecked ? 1 : 0.4 }}
            onClick={handleTermsSubmit} disabled={!termsChecked}
          >
            ENTER THE SIGNAL →
          </button>
        </div>
      </div>
    );
  }

  if (state.step === 'denied') {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, borderTop: `2px solid ${OV.magenta}` }}>
          <FiligreeHead />
          <div style={{
            fontSize: 48, marginBottom: 12,
            filter: `drop-shadow(0 0 12px ${OV.magentaGlow})`,
          }}>
            ✕
          </div>
          <div style={{
            fontSize: 16, color: OV.magentaBright, marginBottom: 10,
            letterSpacing: 3, fontFamily: TYPE.fontDisplay,
            textShadow: `0 0 12px ${OV.magentaGlow}`,
          }}>
            ACCESS RESTRICTED
          </div>
          <p style={{ color: OV.boneDim, fontSize: 12 }}>{state.denialReason}</p>
          <p style={{ color: OV.goldDim, fontSize: 11, marginTop: 12 }}>
            This sweepstakes is not available in your region or to users under 18.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
