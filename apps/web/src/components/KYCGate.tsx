// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// KYC gate modal — required for casino modes.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useKYCStore } from '../store/kycStore.js';
import type { KYCStatus } from '../store/kycStore.js';
import { OV, TYPE } from '../theme/tokens.js';

// Reality duality: verified=cyan (virtual clearance), unverified=magenta (physical block)
const STATUS_COLOR: Record<KYCStatus, string> = {
  unverified: OV.magenta,
  pending:    OV.amberHot,
  verified:   OV.cyan,
};

const STATUS_LABEL: Record<KYCStatus, string> = {
  unverified: 'Not Verified',
  pending:    'Pending Review',
  verified:   'Verified',
};

const inputStyle: React.CSSProperties = {
  background: OV.neural,
  border: `1px solid ${OV.goldDim}`,
  borderRadius: 6, color: OV.bone,
  padding: '8px 10px', fontFamily: TYPE.fontCode, fontSize: 12,
};

export function KYCGate({ requiredForMode }: { requiredForMode?: string }) {
  const { status, modalOpen, openModal: _openModal, closeModal, setStatus } = useKYCStore();
  const [step, setStep] = useState<'intro' | 'form' | 'submitted'>('intro');
  const [name, setName] = useState('');
  const [dob, setDob]   = useState('');
  const [error, setError] = useState('');

  if (!modalOpen) return null;

  const handleSubmit = () => {
    if (!name.trim() || !dob) { setError('All fields are required.'); return; }
    setError('');
    setStatus('pending');
    setStep('submitted');
  };

  const accentColor = STATUS_COLOR[status];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.82)',
      zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(5,0,18,0.97)',
        border: `1px solid ${OV.goldDim}`,
        borderTop: `2px solid ${OV.gold}`,
        borderRadius: 8,
        width: '88%', maxWidth: 400, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 14,
        fontFamily: TYPE.fontCode,
        boxShadow: `0 0 32px rgba(201,168,76,0.1)`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: OV.goldBright, fontSize: 11, fontWeight: 700, letterSpacing: 3 }}>
            IDENTITY VERIFICATION
          </div>
          <button onClick={closeModal} style={{
            background: 'none', border: 'none', color: OV.boneDim,
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
          }}>
            &#x2715;
          </button>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: accentColor, fontSize: 11, fontWeight: 700,
          textShadow: `0 0 8px ${accentColor}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: accentColor,
            boxShadow: `0 0 4px ${accentColor}`,
          }} />
          {STATUS_LABEL[status]}
        </div>

        {requiredForMode && status !== 'verified' && (
          <div style={{
            color: OV.amberHot, fontSize: 11,
            background: 'rgba(255,114,0,0.08)',
            border: `1px solid rgba(255,114,0,0.25)`,
            borderRadius: 6, padding: '6px 10px',
          }}>
            Verification required for {requiredForMode} mode.
          </div>
        )}

        {status === 'verified' ? (
          <div style={{ color: OV.cyan, fontSize: 13, textAlign: 'center', padding: '12px 0',
            textShadow: `0 0 8px ${OV.cyanGlow}` }}>
            ✓ Identity verified — signal cleared.
          </div>
        ) : status === 'pending' || step === 'submitted' ? (
          <div style={{ color: OV.boneDim, fontSize: 12, textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
            Your submission is under review. You will be notified when verification completes.
          </div>
        ) : step === 'intro' ? (
          <>
            <div style={{ color: OV.boneDim, fontSize: 12, lineHeight: 1.7 }}>
              To access casino modes and real-money features, complete identity verification.
              Required by law. Takes less than 2 minutes.
            </div>
            <button onClick={() => setStep('form')} style={{
              background: OV.gold,
              border: 'none', color: OV.void,
              borderRadius: 6, padding: '11px 0',
              fontSize: 12, fontFamily: TYPE.fontCode, cursor: 'pointer', fontWeight: 700,
              letterSpacing: 2,
              boxShadow: `0 0 12px ${OV.goldGlow}`,
            }}>
              BEGIN VERIFICATION →
            </button>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: OV.boneDim, fontSize: 11 }}>
              FULL LEGAL NAME
              <input
                value={name} onChange={e => setName(e.target.value)}
                style={inputStyle}
                placeholder="John Smith"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: OV.boneDim, fontSize: 11 }}>
              DATE OF BIRTH
              <input
                type="date" value={dob} onChange={e => setDob(e.target.value)}
                style={inputStyle}
              />
            </label>
            {error && (
              <div style={{ color: OV.magenta, fontSize: 11, textShadow: `0 0 6px ${OV.magentaGlow}` }}>
                {error}
              </div>
            )}
            <button onClick={handleSubmit} style={{
              background: OV.gold, border: 'none', color: OV.void,
              borderRadius: 6, padding: '11px 0',
              fontSize: 12, fontFamily: TYPE.fontCode, cursor: 'pointer', fontWeight: 700,
              letterSpacing: 2, boxShadow: `0 0 12px ${OV.goldGlow}`,
            }}>
              SUBMIT FOR REVIEW →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function useKYCGate(mode: string | null | undefined) {
  const { status, openModal } = useKYCStore();
  const isCasinoMode = mode === 'VS_CASINO' || mode === 'RALLY_CASINO' || mode === 'HEIST_CASINO';
  const needsKYC = isCasinoMode && status !== 'verified';
  return { needsKYC, openKYC: openModal, kycStatus: status };
}
