// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Game audio hook — subscribes to store events and triggers sounds.
// ─────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useFarkleStore } from '../store/farkleStore.js';
import type { AudioSettings } from '../components/SettingsModal.js';
import {
  resumeCtx, setMasterVolume, setSfxEnabled, setAmbientEnabled,
  playChainAdd, playChainCommit, playFarkle, playBank, playSphereHit,
  playBombBlast, startAmbientDrone, stopAmbientDrone,
} from '../audio/gameAudio.js';

export function useGameAudio(audioSettings: AudioSettings) {
  const prevChainLen = useRef(0);
  const prevUnbanked = useRef(0);
  const prevGamePhase = useRef('idle');

  useEffect(() => {
    setMasterVolume(audioSettings.masterVolume);
    setSfxEnabled(audioSettings.sfxEnabled);
    setAmbientEnabled(audioSettings.ambientEnabled);
  }, [audioSettings.masterVolume, audioSettings.sfxEnabled, audioSettings.ambientEnabled]);

  useEffect(() => {
    const unsub = useFarkleStore.subscribe(state => {
      const chainLen = state.chain.length;
      const gamePhase = state.gamePhase;

      // Chain grow
      if (chainLen > prevChainLen.current) {
        resumeCtx();
        playChainAdd(chainLen);
      }

      // Chain commit (chain clears → unbanked increased)
      if (chainLen === 0 && prevChainLen.current > 0) {
        const unbanked = state.unbanked;
        if (unbanked > prevUnbanked.current) {
          playChainCommit(unbanked - prevUnbanked.current);
        } else if (unbanked <= prevUnbanked.current) {
          playFarkle();
        }
        prevUnbanked.current = unbanked;
      }

      // Phase transitions
      if (gamePhase !== prevGamePhase.current) {
        if (gamePhase === 'playing' && prevGamePhase.current === 'idle') {
          if (audioSettings.ambientEnabled) startAmbientDrone();
        }
        if (gamePhase === 'win' || gamePhase === 'lose') {
          stopAmbientDrone();
        }
        prevGamePhase.current = gamePhase;
      }

      prevChainLen.current = chainLen;
    });
    return unsub;
  }, [audioSettings.ambientEnabled]);

  return { playSphereHit, playBombBlast, playBank };
}
