import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useFarkleStore } from '../store/farkleStore.js';
import { useFarkleGame } from '../hooks/useFarkleGame.js';
import { useMultiplayer } from '../hooks/useMultiplayer.js';
import { VoxelPileScene } from '../game/VoxelPileScene.js';
import { FarkleHUD } from './FarkleHUD.js';
import { VoxelPhysicsSystem } from '@match3d/game-core';
import { LEVELS, DEFAULT_LEVEL } from '../data/levels.js';
import type { DisruptionType } from '@match3d/farkle-shared';

// Wrapper that re-mounts the inner game when retryKey changes
export function GameScreen() {
  const [retryKey, setRetryKey] = useState(0);
  return <GameScreenInner key={retryKey} onRetry={() => setRetryKey(k => k + 1)} />;
}

function GameScreenInner({ onRetry }: { onRetry: () => void }) {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const selectedLevelId = useGameStore(s => s.selectedLevelId);
  const gamePhase = useFarkleStore(s => s.gamePhase);
  const physicsRef = useRef<VoxelPhysicsSystem | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const levelDef = LEVELS.find(l => l.id === selectedLevelId) ?? DEFAULT_LEVEL;
  const { startChain, extendChain, endChain, tapSphere, bankScore, startGame } = useFarkleGame(physicsRef, levelDef);
  const gameMode = useGameStore(s => s.gameMode);
  const { state: mpState, sendDisruption } = useMultiplayer();
  const isDisruptionMode = gameMode === 'VS_FREE' || gameMode === 'VS_CASINO'
    || gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO';

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

  // Apply incoming disruptions from multiplayer to local physics
  useEffect(() => {
    const d = mpState.lastDisruption;
    if (!d) return;
    physicsRef.current?.sendDisruption(d.targetColumns, d.type as 'ice_send' | 'lock_send' | 'scramble');
    useFarkleStore.getState().addDisruption(d);
  }, [mpState.lastDisruption]);

  // Only route away on win/lose after the game has actually started
  useEffect(() => {
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

  const handleDisrupt = useCallback((type: DisruptionType) => {
    // Target opponent's half: cols 0–2 for right-side player, 4–6 for left; send all 7 to let server route
    sendDisruption(type, [0, 1, 2, 3, 4, 5, 6]);
  }, [sendDisruption]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh' }}>
      <VoxelPileScene
        onChainStart={startChain}
        onChainExtend={extendChain}
        onChainEnd={endChain}
        onEntityTap={tapSphere}
      />
      <FarkleHUD
        onBank={bankScore}
        onBack={() => setActiveScreen('home')}
        {...(gameMode ? { gameMode } : {})}
        {...(isDisruptionMode ? { onDisrupt: handleDisrupt } : {})}
      />
    </div>
  );
}
