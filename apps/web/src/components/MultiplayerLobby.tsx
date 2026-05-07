import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';

const S = {
  screen: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', height: '100vh',
    background: '#0a1628', color: '#7ecfff', fontFamily: 'monospace', gap: 16,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#7ecfff', textShadow: '0 0 8px #3af' },
  card: {
    background: 'rgba(13,32,64,0.9)', border: '1px solid #1a4060',
    borderRadius: 12, padding: '20px 28px', minWidth: 300,
    display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  input: {
    background: '#07111f', border: '1px solid #1a4060', color: '#7ecfff',
    borderRadius: 8, padding: '8px 12px', fontFamily: 'monospace', fontSize: 14,
    outline: 'none', width: '100%',
  },
  btnPrimary: {
    background: '#1a6fd4', border: 'none', color: '#fff',
    borderRadius: 8, padding: '10px 20px', fontFamily: 'monospace',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%',
  },
  btnSecondary: {
    background: 'transparent', border: '1px solid #1a4060', color: '#4a8a9a',
    borderRadius: 8, padding: '8px 16px', fontFamily: 'monospace',
    fontSize: 12, cursor: 'pointer', width: '100%',
  },
  label: { fontSize: 11, color: '#4a6080', textTransform: 'uppercase' as const, letterSpacing: 1 },
  roomCode: {
    fontSize: 36, fontWeight: 900, letterSpacing: 8, color: '#ffd700',
    textShadow: '0 0 12px #ffd700', textAlign: 'center' as const,
  },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 0', borderBottom: '1px solid #1a2840',
  },
  dot: (active: boolean) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: active ? '#22c55e' : '#1a4060',
    boxShadow: active ? '0 0 4px #22c55e' : 'none',
    flexShrink: 0,
  }),
  error: { color: '#ff6060', fontSize: 12, textAlign: 'center' as const },
};

export function MultiplayerLobby() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const { state, createRoom, joinRoom, leaveRoom } = useMultiplayer();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  const myId = state.playerId;

  function handleCreate() {
    if (!playerName.trim()) return;
    createRoom(playerName.trim());
  }

  function handleJoin() {
    if (!playerName.trim() || joinCode.length < 4) return;
    joinRoom(joinCode, playerName.trim());
  }

  function handleLeave() {
    leaveRoom();
    setActiveScreen('home');
  }

  // ── Lobby (in room) ──────────────────────────────────────────────────────────

  if (state.status === 'lobby' || state.status === 'playing') {
    return (
      <div style={S.screen}>
        <div style={S.title}>MULTIPLAYER LOBBY</div>

        <div style={S.card}>
          <div style={S.label}>Room Code</div>
          <div style={S.roomCode}>{state.roomCode}</div>
          <div style={{ color: '#4a6080', fontSize: 11, textAlign: 'center' }}>
            Share this code with friends
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Players ({state.players.length})</div>
          {state.players.length === 0 && (
            <div style={{ color: '#4a6080', fontSize: 12 }}>Waiting for players...</div>
          )}
          {state.players.map(p => (
            <div key={p.id} style={S.playerRow}>
              <div style={S.dot(p.isConnected)} />
              <span style={{ flex: 1, color: p.id === myId ? '#7ecfff' : '#a0c0d0', fontSize: 14 }}>
                {p.name}{p.id === myId ? ' (you)' : ''}
              </span>
              {p.id === state.activePlayerId && (
                <span style={{ color: '#ffd700', fontSize: 10 }}>● TURN</span>
              )}
              <span style={{ color: '#4a6080', fontSize: 11 }}>{p.banked.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {state.error && <div style={S.error}>{state.error}</div>}

        <button style={S.btnSecondary} onClick={handleLeave}>← Leave Room</button>
      </div>
    );
  }

  // ── Connect UI ───────────────────────────────────────────────────────────────

  return (
    <div style={S.screen}>
      <div style={S.title}>MULTIPLAYER</div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['create', 'join'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...S.btnSecondary, width: 'auto', flex: 1,
                borderColor: tab === t ? '#3af' : '#1a4060',
                color: tab === t ? '#7ecfff' : '#4a8a9a',
              }}
            >
              {t === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        <div style={S.label}>Your Name</div>
        <input
          style={S.input}
          placeholder="Enter your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
        />

        {tab === 'join' && (
          <>
            <div style={S.label}>Room Code</div>
            <input
              style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 4, fontSize: 18 }}
              placeholder="XXXXXX"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </>
        )}

        {state.error && <div style={S.error}>{state.error}</div>}

        <button
          style={{ ...S.btnPrimary, opacity: state.status === 'connecting' ? 0.6 : 1 }}
          disabled={state.status === 'connecting'}
          onClick={tab === 'create' ? handleCreate : handleJoin}
        >
          {state.status === 'connecting' ? 'Connecting...' : tab === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </div>

      <button style={S.btnSecondary} onClick={() => setActiveScreen('home')}>← Back</button>
    </div>
  );
}
