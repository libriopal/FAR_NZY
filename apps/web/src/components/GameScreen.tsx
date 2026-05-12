// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState, Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useFarkleStore } from '../store/farkleStore.js';
import { useFarkleGame } from '../hooks/useFarkleGame.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';
import { VoxelPileScene } from '../game/VoxelPileScene.js';
import { FarkleHUD } from './FarkleHUD.js';
import { SettingsModal } from './SettingsModal.js';
import { TransitionOverlay } from './TransitionOverlay.js';
import type { AudioSettings } from './SettingsModal.js';
import { VoxelPhysicsSystem } from '@match3d/game-core';
import { adManager } from '@match3d/ads';
import { useGameAudio } from '../hooks/useGameAudio.js';
import { LEVELS, DEFAULT_LEVEL } from '../data/levels.js';
import type { DisruptionType } from '@match3d/farkle-shared';

class GameErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message ?? String(e) }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[GameScreen] render crash:', e, info); }
  private _goHome = () => {
    this.setState({ error: null });
    useGameStore.getState().setActiveScreen('home');
  };
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100dvh', background: '#0a1628', color: '#ef4444', fontFamily: 'monospace',
          padding: 24, gap: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Unexpected Error</div>
          <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 300, wordBreak: 'break-all' }}>
            {this.state.error}
          </div>
          <button onClick={this._goHome} style={{
            background: '#1e40af', border: 'none', color: '#fff',
            borderRadius: 8, padding: '10px 20px', fontFamily: 'monospace', cursor: 'pointer',
          }}>
            ← Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrapper that re-mounts the inner game when retryKey changes
export function GameScreen() {
  const [retryKey, setRetryKey] = useState(0);
  return (
    <GameErrorBoundary>
      <GameScreenInner key={retryKey} onRetry={() => setRetryKey(k => k + 1)} />
    </GameErrorBoundary>
  );
}

function GameScreenInner({ onRetry }: { onRetry: () => void }) {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const gamePhase = useFarkleStore(s => s.gamePhase);
  const physicsRef = useRef<VoxelPhysicsSystem | null>(null);
  const gameStartedRef = useRef(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ masterVolume: 0.7, sfxEnabled: true, ambientEnabled: true });
  const levelDef = LEVELS.find(l => l.id === selectedLevelId) ?? DEFAULT_LEVEL;
  const gameMode = useGameStore(s => s.gameMode);
  const { startChain, extendChain, endChain, tapSphere, bankScore, passScore, startGame, confirmRainmakerBomb, initiateHeist, blockHeist, rallyBank, rallyPass, rallyContinue } = useFarkleGame(physicsRef, levelDef, gameMode ?? undefined);
  useGameAudio(audioSettings);
  const { state: mpState, sendDisruption, sendRallyVote, sendRallyDecisionStart } = useMultiplayer();
  const isMultiplayer = !!mpState.roomCode;
  const isDisruptionMode = gameMode === 'VS_FREE' || gameMode === 'VS_CASINO'
    || gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO';
  const isRallyMode = gameMode === 'RALLY_FREE' || gameMode === 'RALLY_CASINO';

  // Must be above early returns — hooks must always be called in the same order
  const handleDisrupt = useCallback((type: DisruptionType) => {
    sendDisruption(type, [0, 1, 2, 3, 4, 5, 6]);
  }, [sendDisruption]);

  useEffect(() => {
    // Synchronously clear any stale win/lose phase so routing effect doesn't fire immediately
    useFarkleStore.getState().resetGame();

    let cancelled = false;
    setInitError(null);

    VoxelPhysicsSystem.create(Date.now()).then(sys => {
      if (cancelled) { sys.destroy(); return; }
      physicsRef.current = sys;
      sys.startSimulation(
        (transforms) => {
          const chainSet = new Set(useFarkleStore.getState().chain);
          useFarkleStore.getState().updateBodies(
            transforms.map(t => ({ ...t, type: (t.entityType === 'sphere' ? 'sphere' : 'die') as 'die' | 'sphere', inChain: chainSet.has(t.id) }))
          );
        },
        () => useFarkleStore.setState({ gamePhase: 'lose' }),
      );
      adManager.showInterstitial();
      gameStartedRef.current = true;
      startGame();
    }).catch(err => {
      if (!cancelled) {
        console.error('[GameScreen] Physics init failed:', err);
        setInitError(String(err));
      }
    });

    return () => {
      cancelled = true;
      physicsRef.current?.destroy();
      physicsRef.current = null;
    };
  }, []);

  // Sync rally role from multiplayer state into farkle store
  useEffect(() => {
    useFarkleStore.getState().setRallyRole(mpState.myRole);
  }, [mpState.myRole]);

  // Apply incoming disruptions from multiplayer to local physics
  useEffect(() => {
    const d = mpState.lastDisruption;
    if (!d) return;
    physicsRef.current?.sendDisruption(d.targetColumns, d.type as 'ice_send' | 'lock_send' | 'scramble');
    useFarkleStore.getState().addDisruption(d);
  }, [mpState.lastDisruption]);

  // C15: Handle incoming rally vote messages from server
  useEffect(() => {
    const msg = mpState.lastMessage;
    if (!msg) return;
    if (msg.type === 'RALLY_DECISION_START') {
      useFarkleStore.getState().setRallyDecision(true, msg.expiresAt as number);
    } else if (msg.type === 'RALLY_VOTE_UPDATE') {
      useFarkleStore.getState().setRallyVotes(msg.votes as Record<string, string>);
    } else if (msg.type === 'RALLY_DECISION') {
      const outcome = msg.decision as string;
      if (outcome === 'bank') rallyBank();
      else if (outcome === 'pass') rallyPass();
      else if (outcome === 'continue') rallyContinue();
      useFarkleStore.getState().clearRallyVotes();
    }
  }, [mpState.lastMessage]);

  // C15: When active player triggers a rally decision, notify server so all players see the panel
  const rallyDecisionActive = useFarkleStore(s => s.rallyDecisionActive);
  const rallyDecisionExpiresAt = useFarkleStore(s => s.rallyDecisionExpiresAt);
  useEffect(() => {
    if (rallyDecisionActive && isMultiplayer && rallyDecisionExpiresAt && mpState.playerId === mpState.activePlayerId) {
      sendRallyDecisionStart(rallyDecisionExpiresAt);
    }
  }, [rallyDecisionActive]);

  // C15: Multiplayer rally vote wrappers — send vote to server; solo applies locally
  const handleRallyBank = useCallback(() => {
    if (isMultiplayer) sendRallyVote('bank');
    else rallyBank();
  }, [isMultiplayer, rallyBank, sendRallyVote]);

  const handleRallyPass = useCallback(() => {
    if (isMultiplayer) sendRallyVote('pass');
    else rallyPass();
  }, [isMultiplayer, rallyPass, sendRallyVote]);

  const handleRallyContinue = useCallback(() => {
    if (isMultiplayer) sendRallyVote('continue');
    else rallyContinue();
  }, [isMultiplayer, rallyContinue, sendRallyVote]);

  // Only route away on win/lose AFTER physics has initialized and startGame() was called.
  // gameStartedRef prevents stale 'lose'/'win' from a previous session from firing immediately.
  useEffect(() => {
    if (!gameStartedRef.current) return;
    if (gamePhase === 'win') setActiveScreen('win');
    if (gamePhase === 'lose') setActiveScreen('lose');
  }, [gamePhase]);

  if (initError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: 'var(--ba-surface-bg)', color: 'var(--ba-danger)', fontFamily: 'monospace',
        padding: 24, gap: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Physics Init Failed</div>
        <div style={{ fontSize: 11, color: 'var(--ba-marble-800)', maxWidth: 300, wordBreak: 'break-all' }}>
          {initError}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onRetry} style={{
            background: 'var(--ba-accent)', border: 'none', color: '#fff',
            borderRadius: 8, padding: '10px 20px', fontFamily: 'monospace', cursor: 'pointer',
          }}>
            ↺ Retry
          </button>
          <button onClick={() => setActiveScreen('home')} style={{
            background: 'transparent', border: '1px solid var(--ba-card-border)', color: 'var(--ba-marble-500)',
            borderRadius: 8, padding: '10px 20px', fontFamily: 'monospace', cursor: 'pointer',
          }}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (gamePhase === 'idle') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', background: 'var(--ba-surface-bg)', color: 'var(--ba-accent)', fontFamily: 'monospace', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid var(--ba-card-border)', borderTopColor: 'var(--ba-accent)',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 14 }}>Loading physics...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <button onClick={() => setActiveScreen('home')} style={{
          background: 'transparent', border: '1px solid var(--ba-card-border)', color: 'var(--ba-marble-500)',
          borderRadius: 8, padding: '8px 20px', fontFamily: 'monospace', cursor: 'pointer',
          fontSize: 12, marginTop: 8,
        }}>
          ← Back
        </button>
      </div>
    );
  }

  const modeName = gameMode ? gameMode.replace('_', ' ') : 'SOLO';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100dvh', overflow: 'hidden', background: '#0a1628' }}>
      {/* TopBar — 44px */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0, borderBottom: '1px solid #1e1b4b' }}>
        <button onClick={() => setActiveScreen('home')} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: 4 }}>&#8592;</button>
        <div style={{ color: '#7c3aed', fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: 'monospace' }}>{modeName}</div>
        <button onClick={() => setSettingsOpen(true)} style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 18, cursor: 'pointer', padding: 4 }}>&#9881;</button>
      </div>

      {/* Game canvas — flex-1 */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <VoxelPileScene
          onChainStart={startChain}
          onChainExtend={extendChain}
          onChainEnd={endChain}
          onEntityTap={tapSphere}
        />
        <FarkleHUD
          onBank={bankScore}
          onBack={() => setActiveScreen('home')}
          onRainmakerSelect={confirmRainmakerBomb}
          {...(gameMode ? { gameMode } : {})}
          {...(isDisruptionMode ? { onDisrupt: handleDisrupt } : {})}
          {...(isRallyMode ? { onPass: passScore, onRallyBank: handleRallyBank, onRallyPass: handleRallyPass, onRallyContinue: handleRallyContinue } : {})}
          {...((gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO') ? { onInitiateHeist: initiateHeist, onBlockHeist: blockHeist } : {})}
        />
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        audioSettings={audioSettings}
        onAudioChange={setAudioSettings}
      />
      <TransitionOverlay />
    </div>
  );
}
