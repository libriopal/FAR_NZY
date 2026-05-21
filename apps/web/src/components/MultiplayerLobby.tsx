// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';
import { LEVELS } from '../data/levels.js';
import type { GameMode } from '@match3d/farkle-shared';
import { OV, TYPE, CURRENCY } from '../theme/tokens.js';

const MODE_OPTIONS: { value: GameMode; label: string; desc: string }[] = [
  { value: 'VS_FREE',    label: 'VS',    desc: '1v1 — disrupt your opponent' },
  { value: 'HEIST_FREE', label: 'Heist', desc: 'Score under fire — 90s, free disrupts in FRENZY' },
  { value: 'RALLY_FREE', label: 'Rally', desc: '4 roles — 180s team blitz' },
];

const S = {
  screen: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh',
    background: OV.void,
    backgroundImage: `radial-gradient(ellipse at 50% 20%, rgba(0,229,255,0.05) 0%, transparent 55%)`,
    color: OV.bone, fontFamily: TYPE.fontCode, gap: 16, padding: 24,
  },
  title: {
    fontSize: 18, fontWeight: 900, color: OV.goldBright, letterSpacing: 4,
    fontFamily: TYPE.fontDisplay,
    textShadow: `0 0 16px ${OV.goldGlow}`,
  },
  card: {
    background: 'rgba(13,0,24,0.88)',
    border: `1px solid ${OV.goldDim}`,
    borderRadius: 8, padding: '20px 24px', width: '100%', maxWidth: 340,
    display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  label: {
    fontSize: 9, color: OV.boneDim,
    textTransform: 'uppercase' as const, letterSpacing: 3,
  },
  roomCode: {
    fontSize: 34, fontWeight: 900, letterSpacing: 8, color: OV.goldBright,
    textShadow: `0 0 12px ${OV.goldGlow}`, textAlign: 'center' as const,
    fontFamily: TYPE.fontCode,
  },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 0', borderBottom: `1px solid ${OV.goldDim}`,
  },
  dot: (active: boolean): React.CSSProperties => ({
    width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
    background: active ? OV.cyan : OV.goldDim,
    boxShadow: active ? `0 0 4px ${OV.cyan}` : 'none',
  }),
  input: {
    background: OV.neural, border: `1px solid ${OV.goldDim}`,
    color: OV.bone, borderRadius: 6,
    padding: '9px 12px', fontFamily: TYPE.fontCode, fontSize: 13,
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    background: OV.cyan, border: 'none', color: OV.void,
    borderRadius: 6, padding: '12px 0',
    fontFamily: TYPE.fontCode, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', width: '100%', letterSpacing: 2,
    boxShadow: `0 0 14px ${OV.cyanGlow}`,
  },
  btnSecondary: {
    background: 'transparent', border: `1px solid ${OV.goldDim}`, color: OV.boneDim,
    borderRadius: 6, padding: '9px 16px',
    fontFamily: TYPE.fontCode, fontSize: 11, cursor: 'pointer', width: '100%',
  },
  error: { color: OV.magenta, fontSize: 12, textAlign: 'center' as const,
    textShadow: `0 0 6px ${OV.magentaGlow}` },
};

export function MultiplayerLobby() {
  const setActiveScreen  = useGameStore(s => s.setActiveScreen);
  const setGameMode      = useGameStore(s => s.setGameMode);
  const selectedLevelId  = useGameStore(s => s.selectedLevelId);
  const { state, createRoom, joinRoom, startGame, leaveRoom } = useMultiplayer();

  const [playerName, setPlayerName]   = useState('');
  const [joinCode, setJoinCode]       = useState('');
  const [tab, setTab]                 = useState<'create' | 'join'>('create');
  const [selectedMode, setSelectedMode] = useState<GameMode>('VS_FREE');

  const myId = state.playerId;

  useEffect(() => {
    if (state.status === 'playing') setActiveScreen('game');
  }, [state.status, setActiveScreen]);

  function handleCreate() {
    if (!playerName.trim()) return;
    setGameMode(selectedMode);
    const levelWinScore = LEVELS.find(l => l.id === selectedLevelId)?.winScore ?? 100_000;
    createRoom(playerName.trim(), selectedMode, levelWinScore);
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
          <div style={{ color: OV.boneDim, fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>
            Share this code with allies
          </div>
        </div>

        <div style={S.card}>
          <div style={S.label}>Players ({state.players.length})</div>
          {state.players.length === 0 && (
            <div style={{ color: OV.boneDim, fontSize: 12 }}>Waiting for players…</div>
          )}
          {state.players.map(p => (
            <div key={p.id} style={S.playerRow}>
              <div style={S.dot(p.isConnected)} />
              <span style={{ flex: 1, color: p.id === myId ? OV.cyan : OV.bone, fontSize: 13 }}>
                {p.name}{p.id === myId ? ' (you)' : ''}
              </span>
              {p.id === state.activePlayerId && (
                <span style={{ color: OV.goldBright, fontSize: 9, letterSpacing: 1,
                  textShadow: `0 0 6px ${OV.goldGlow}` }}>● TURN</span>
              )}
              <span style={{ color: OV.boneDim, fontSize: 10 }}>{p.banked.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {state.error && <div style={S.error}>{state.error}</div>}

        {state.players.length >= 2 ? (
          <button style={S.btnPrimary} onClick={startGame}>▶ START GAME</button>
        ) : (
          <div style={{ color: OV.boneDim, fontSize: 10, textAlign: 'center', letterSpacing: 1 }}>
            Waiting for {2 - state.players.length} more player{state.players.length === 1 ? '' : 's'}…
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
        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['create', 'join'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              ...S.btnSecondary, width: 'auto', flex: 1,
              borderColor: tab === t ? OV.cyan : OV.goldDim,
              color: tab === t ? OV.cyan : OV.boneDim,
              boxShadow: tab === t ? `0 0 6px ${OV.cyanGlow}` : 'none',
            }}>
              {t === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        {/* Game mode selector */}
        <div style={S.label}>Game Mode</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MODE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setSelectedMode(opt.value)} style={{
              flex: 1, background: selectedMode === opt.value ? 'rgba(123,0,255,0.18)' : 'transparent',
              border: `1px solid ${selectedMode === opt.value ? CURRENCY.pdx.color : OV.goldDim}`,
              color: selectedMode === opt.value ? CURRENCY.pdx.particleColor : OV.boneDim,
              borderRadius: 6, padding: '8px 4px', fontSize: 11, cursor: 'pointer',
              fontFamily: TYPE.fontCode, fontWeight: selectedMode === opt.value ? 700 : 400,
            }}>
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ color: OV.boneDim, fontSize: 10, letterSpacing: 1 }}>
          {MODE_OPTIONS.find(o => o.value === selectedMode)?.desc}
        </div>

        {/* Name input */}
        <div style={S.label}>Your Name</div>
        <input
          style={S.input}
          placeholder="Enter your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          maxLength={16}
        />

        {/* Join code */}
        {tab === 'join' && (
          <>
            <div style={S.label}>Room Code</div>
            <input
              style={{ ...S.input, textTransform: 'uppercase', letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
              placeholder="XXXXXX"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </>
        )}

        {state.error && <div style={S.error}>{state.error}</div>}

        <button
          style={{ ...S.btnPrimary, opacity: state.status === 'connecting' ? 0.5 : 1 }}
          disabled={state.status === 'connecting'}
          onClick={tab === 'create' ? handleCreate : handleJoin}
        >
          {state.status === 'connecting'
            ? 'Connecting…'
            : tab === 'create' ? 'Create Room' : 'Join Room'}
        </button>
      </div>

      <button style={S.btnSecondary} onClick={() => setActiveScreen('home')}>← Back</button>
    </div>
  );
}
