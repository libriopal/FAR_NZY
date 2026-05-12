// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// KYC gate modal — required for casino modes.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useKYCStore } from '../store/kycStore.js';
import type { KYCStatus } from '../store/kycStore.js';

const STATUS_COLOR: Record<KYCStatus, string> = {
  unverified: '#ef4444',
  pending: '#f59e0b',
  verified: '#10b981',
};

const STATUS_LABEL: Record<KYCStatus, string> = {
  unverified: 'Not Verified',
  pending: 'Pending Review',
  verified: 'Verified',
};

export function KYCGate({ requiredForMode }: { requiredForMode?: string }) {
  const { status, modalOpen, openModal, closeModal, setStatus } = useKYCStore();
  const [step, setStep] = useState<'intro' | 'form' | 'submitted'>('intro');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');

  if (!modalOpen) return null;

  const handleSubmit = () => {
    if (!name.trim() || !dob) { setError('All fields are required.'); return; }
    setError('');
    setStatus('pending');
    setStep('submitted');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f0a1e', border: '1px solid #4f46e5', borderRadius: 14,
        width: '88%', maxWidth: 400, padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
        fontFamily: 'monospace',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
            IDENTITY VERIFICATION
          </div>
          <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer' }}>
            &#x2715;
          </button>
        </div>

        <div style={{ color: STATUS_COLOR[status], fontSize: 11, fontWeight: 700 }}>
          Status: {STATUS_LABEL[status]}
        </div>

        {requiredForMode && status !== 'verified' && (
          <div style={{ color: '#f59e0b', fontSize: 11, background: 'rgba(245,158,11,0.1)', borderRadius: 6, padding: '6px 10px' }}>
            Verification required for {requiredForMode} mode.
          </div>
        )}

        {status === 'verified' ? (
          <div style={{ color: '#10b981', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            Your identity has been verified.
          </div>
        ) : status === 'pending' || step === 'submitted' ? (
          <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
            Your submission is under review. You will be notified when verification completes.
          </div>
        ) : step === 'intro' ? (
          <>
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
              To access casino modes and real-money features, you must complete identity verification.
              This is required by law and takes less than 2 minutes.
            </div>
            <button onClick={() => setStep('form')} style={{
              background: '#4f46e5', border: 'none', color: '#fff', borderRadius: 8,
              padding: '10px 0', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', fontWeight: 700,
            }}>
              Begin Verification
            </button>
          </>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#e2e8f0', fontSize: 12 }}>
              Full Legal Name
              <input
                value={name} onChange={e => setName(e.target.value)}
                style={{ background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 6, color: '#fff', padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}
                placeholder="John Smith"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#e2e8f0', fontSize: 12 }}>
              Date of Birth
              <input
                type="date" value={dob} onChange={e => setDob(e.target.value)}
                style={{ background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 6, color: '#fff', padding: '8px 10px', fontFamily: 'monospace', fontSize: 12 }}
              />
            </label>
            {error && <div style={{ color: '#ef4444', fontSize: 11 }}>{error}</div>}
            <button onClick={handleSubmit} style={{
              background: '#4f46e5', border: 'none', color: '#fff', borderRadius: 8,
              padding: '10px 0', fontSize: 12, fontFamily: 'monospace', cursor: 'pointer', fontWeight: 700,
            }}>
              Submit for Review
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
