import { useEffect, useRef, useCallback } from 'react';
import { GameSessionManager } from '@match3d/game-core';
import type { LevelConfig, ItemDefinition, EstateUpgrade } from '@match3d/game-core';
import { useGameStore } from '../store/gameStore.js';
import { analytics } from '@match3d/analytics';
import { blockchainQueue } from '@match3d/blockchain';
import itemDefinitionsJson from '@assets/items/item-definitions.json';

export function useGameSession() {
  const setSession = useGameStore(s => s.setSession);
  const updateGameState = useGameStore(s => s.updateGameState);
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const setShowReviveModal = useGameStore(s => s.setShowReviveModal);
  const sessionRef = useRef<GameSessionManager | null>(null);
  const itemDefsRef = useRef<ItemDefinition[]>([]);

  const initSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;

    const itemDefsResp = itemDefinitionsJson as unknown as ItemDefinition[];
    itemDefsRef.current = itemDefsResp;

    const session = new GameSessionManager();
    await session.init({
      itemDefinitions: itemDefsResp,
      estateUpgrades: [] as EstateUpgrade[],
    });

    // ── Wire events to store ──
    session.bus.on('tray:updated', (slots) => {
      updateGameState({ traySlots: slots });
    });

    session.bus.on('match:resolved', (result) => {
      analytics.track({ name: 'match_resolved', props: { definitionId: result.definitionId, scoreValue: result.scoreValue, comboCount: 0 } });
      blockchainQueue.enqueue({
        userId: useGameStore.getState().userId ?? 'anon',
        entryType: 'level_result',
        payloadHash: '', // filled async
        timestamp: Date.now(),
      });
    });

    session.bus.on('level:won', (data) => {
      updateGameState({ gamePhase: 'win', score: data.score });
      setActiveScreen('win');
      analytics.track({ name: 'level_complete', props: { levelId: useGameStore.getState().currentLevel?.id ?? '', ...data, objectivesCompleted: data.objectivesCompleted } });
    });

    session.bus.on('level:lost', (data) => {
      updateGameState({ gamePhase: 'lose' });
      if (data.reason === 'overflow') setShowReviveModal(true);
      else setActiveScreen('lose');
      analytics.track({ name: 'level_fail', props: { levelId: useGameStore.getState().currentLevel?.id ?? '', reason: data.reason, score: useGameStore.getState().score } });
    });

    session.bus.on('objective:progress', () => {
      updateGameState({ objectives: session.objectiveSystem.getObjectives() });
    });

    session.bus.on('match:combo', (data) => {
      updateGameState({ comboCount: data.count });
    });

    sessionRef.current = session;
    setSession(session);
    return session;
  }, [setSession, updateGameState, setActiveScreen, setShowReviveModal]);

  const startLevel = useCallback(async (levelConfig: LevelConfig) => {
    const session = await initSession();
    await session.startLevel(levelConfig);
    updateGameState({
      gamePhase: 'playing',
      score: 0,
      timeRemaining: levelConfig.timerSeconds,
      objectives: session.objectiveSystem.getObjectives(),
      comboCount: 0,
    });
    setActiveScreen('game');
    analytics.track({ name: 'level_start', props: { levelId: levelConfig.id, attemptNumber: 1 } });
  }, [initSession, updateGameState, setActiveScreen]);

  const selectItem = useCallback((itemId: string) => {
    sessionRef.current?.selectItem(itemId);
  }, []);

  // Sync timer to store every 250ms
  useEffect(() => {
    const iv = setInterval(() => {
      const s = sessionRef.current;
      if (!s) return;
      const state = s.getState();
      updateGameState({ timeRemaining: state.timeRemaining, score: state.score });
    }, 250);
    return () => clearInterval(iv);
  }, [updateGameState]);

  return { initSession, startLevel, selectItem, sessionRef };
}
