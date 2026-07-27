// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 §13/§31: optional, in-session discovery-notes capture.
// Fires once per session, on the local player's first Farkle. Never blocks
// play, never scored, never interpreted — raw human words only.
// ─────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useFarkleStore } from '../store/farkleStore.js';
import { useMultiplayerStore } from '../store/multiplayerStore.js';
import { submitDiscoveryNote } from '../evidence/evidenceClient.js';

export function DiscoveryNotePrompt() {
  const userId = useGameStore(s => s.userId);
  const farkleCount = useFarkleStore(s => s.farkleCount);
  const mpPlayerId = useMultiplayerStore(s => s.playerId);
  const activePlayerId = useMultiplayerStore(s => s.activePlayerId);

  const prevCount = useRef(0);
  const hasPrompted = useRef(false);
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    const wasFirstFarkle = prevCount.current === 0 && farkleCount > 0;
    prevCount.current = farkleCount;
    if (!wasFirstFarkle || hasPrompted.current) return;

    // In multiplayer, only prompt the player whose Farkle this actually was —
    // farkleCount is shared state and increments for any player's turn.
    const isLocalPlayersFarkle = mpPlayerId == null || activePlayerId == null || mpPlayerId === activePlayerId;
    if (!isLocalPlayersFarkle) return;

    hasPrompted.current = true;
    setVisible(true);
  }, [farkleCount, mpPlayerId, activePlayerId]);

  const submit = useCallback(() => {
    if (userId && text.trim()) {
      submitDiscoveryNote({ player_id: userId, text: text.trim(), event_type: 'discovery_claim' });
    }
    setVisible(false);
  }, [userId, text]);

  if (!visible || !userId) return null;

  return (
    <div className="ba-glass" style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, borderRadius: 10, border: '1px solid var(--ba-card-border)',
      padding: '12px 16px', width: '100%', maxWidth: 300, textAlign: 'left',
    }}>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 12, marginBottom: 6 }}>
        What happened there? (optional)
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
        <button onClick={() => setVisible(false)} style={{
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
