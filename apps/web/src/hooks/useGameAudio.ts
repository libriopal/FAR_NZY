// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Game audio hook — subscribes to store events and triggers sounds.
// ─────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useFarkleStore } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import type { AudioSettings } from '../components/SettingsModal.js';
import {
  resumeCtx, setMasterVolume, setSfxEnabled, setAmbientEnabled,
  playChainAdd, playChainCommit, playFarkle, playBank, playSphereHit,
  playBombBlast, playBombCollapse,
  startAmbientDrone, stopAmbientDrone,
  startHeroJourneyTheme, stopHeroJourneyTheme,
} from '../audio/gameAudio.js';

export function useGameAudio(audioSettings: AudioSettings) {
  const prevChainLen     = useRef(0);
  const prevUnbanked     = useRef(0);
  const prevGamePhase    = useRef('idle');
  const prevExplosionCount = useRef(0);

  useEffect(() => {
    setMasterVolume(audioSettings.masterVolume);
    setSfxEnabled(audioSettings.sfxEnabled);
    setAmbientEnabled(audioSettings.ambientEnabled);
  }, [audioSettings.masterVolume, audioSettings.sfxEnabled, audioSettings.ambientEnabled]);

  // ── Main game state subscriber ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = useFarkleStore.subscribe(state => {
      const chainLen  = state.chain.length;
      const gamePhase = state.gamePhase;

      // Chain grow
      if (chainLen > prevChainLen.current) {
        resumeCtx();
        playChainAdd(chainLen);
      }

      // Chain commit — chain cleared; check if score increased or farkled
      if (chainLen === 0 && prevChainLen.current > 0) {
        const unbanked = state.unbanked;
        if (unbanked > prevUnbanked.current) {
          playChainCommit(unbanked - prevUnbanked.current);
        } else {
          playFarkle();
        }
        prevUnbanked.current = unbanked;
      }

      // Phase transitions
      if (gamePhase !== prevGamePhase.current) {
        if (gamePhase === 'playing' && prevGamePhase.current === 'idle') {
          if (audioSettings.ambientEnabled) {
            startAmbientDrone();
            startHeroJourneyTheme();
          }
        }
        if (gamePhase === 'win' || gamePhase === 'lose') {
          stopAmbientDrone();
          stopHeroJourneyTheme();
        }
        prevGamePhase.current = gamePhase;
      }

      prevChainLen.current = chainLen;
    });
    return unsub;
  }, [audioSettings.ambientEnabled]);

  // ── Bomb explosion → necrotic collapse sound ───────────────────────────────
  useEffect(() => {
    const unsub = useExplosionStore.subscribe(state => {
      const count = state.explosions.length;
      if (count > prevExplosionCount.current) {
        const latest = state.explosions[state.explosions.length - 1];
        if (latest) playBombCollapse(latest.type === 'rainbow_bomb');
      }
      prevExplosionCount.current = count;
    });
    return unsub;
  }, []);

  return { playSphereHit, playBombBlast, playBank };
}
