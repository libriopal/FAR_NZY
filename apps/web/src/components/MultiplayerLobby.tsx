// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';
import type { GameMode } from '@match3d/farkle-shared';

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

const MODE_OPTIONS: { value: GameMode; label: string; desc: string }[] = [
  { value: 'VS_FREE',    label: '⚔ VS',    desc: '1v1 — disrupt your opponent' },
  { value: 'HEIST_FREE', label: '💀 Heist', desc: 'Score under fire — 90s, free disrupts in FRENZY' },
  { value: 'RALLY_FREE', label: '🏆 Rally', desc: '4 roles — 180s team blitz' },
];

export function MultiplayerLobby() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const setGameMode = useGameStore(s => s.setGameMode);
  const { state, createRoom, joinRoom, startGame, leaveRoom } = useMultiplayer();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [selectedMode, setSelectedMode] = useState<GameMode>('VS_FREE');

  const myId = state.playerId;

  // Auto-navigate when server broadcasts GAME_STARTED
  useEffect(() => {
    if (state.status === 'playing') setActiveScreen('game');
  }, [state.status, setActiveScreen]);

  function handleCreate() {
    if (!playerName.trim()) return;
    setGameMode(selectedMode);
    createRoom(playerName.trim(), selectedMode);
  }

  function handleJoin() {
    if (!playerName.trim() || joinCode.length < 4) return;
    setGameMode(selectedMode);
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

        {state.players.length >= 2 && (
          <button style={S.btnPrimary} onClick={startGame}>▶ Start Game</button>
        )}
        {state.players.length < 2 && (
          <div style={{ color: '#4a6080', fontSize: 11, textAlign: 'center' }}>
            Waiting for {2 - state.players.length} more player{state.players.length === 1 ? '' : 's'}...
          </div>
        )}

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

        <div style={S.label}>Game Mode</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedMode(opt.value)}
              style={{
                ...S.btnSecondary, flex: 1, width: 'auto',
                borderColor: selectedMode === opt.value ? '#a78bfa' : '#1a4060',
                color: selectedMode === opt.value ? '#e9d5ff' : '#4a8a9a',
                background: selectedMode === opt.value ? 'rgba(124,58,237,0.15)' : 'transparent',
                fontSize: 13,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ color: '#4a6080', fontSize: 11 }}>
          {MODE_OPTIONS.find(o => o.value === selectedMode)?.desc}
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
