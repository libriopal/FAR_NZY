// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 §38: optional, single, end-of-session free-text prompt.
// Never blocks navigation. May be skipped. Not a survey, not scored.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { submitSessionRetrospective } from '../evidence/evidenceClient.js';

export function SessionRetrospectivePrompt() {
  const userId = useGameStore(s => s.userId);
  const [text, setText] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const submit = useCallback(() => {
    if (userId && text.trim()) {
      submitSessionRetrospective({ player_id: userId, text: text.trim() });
    }
    setDismissed(true);
  }, [userId, text]);

  if (dismissed || !userId) return null;

  return (
    <div className="ba-glass" style={{
      borderRadius: 10, border: '1px solid var(--ba-card-border)',
      padding: '12px 16px', marginTop: 16, width: '100%', maxWidth: 300,
      textAlign: 'left',
    }}>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 12, marginBottom: 6 }}>
        What stands out from this session? (optional)
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'monospace',
          fontSize: 13, borderRadius: 6, border: '1px solid var(--ba-card-border)',
          background: 'transparent', color: 'inherit', padding: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setDismissed(true)} style={{
          background: 'transparent', border: 'none', color: 'var(--ba-marble-500)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
        }}>
          Skip
        </button>
        <button onClick={submit} style={{
          background: 'transparent', border: '1px solid var(--ba-card-border)', borderRadius: 6,
          color: 'inherit', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', padding: '4px 10px',
        }}>
          Send
        </button>
      </div>
    </div>
  );
}
