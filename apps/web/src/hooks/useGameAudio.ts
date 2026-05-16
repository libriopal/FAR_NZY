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
  setMusicState,
} from '../audio/gameAudio.js';
import type { EmotionalState } from '../audio/gameAudio.js';

function resolveEmotionalState(
  chainLen: number,
  gamePhase: string,
  unbanked: number,
): EmotionalState {
  if (gamePhase === 'win') return 'euphoric';
  if (gamePhase === 'lose') return 'melancholic';
  if (gamePhase !== 'playing') return 'calm';
  if (chainLen >= 5) return 'euphoric';
  if (chainLen >= 3) return 'tense';
  if (unbanked > 50_000) return 'euphoric';
  return 'calm';
}

export function useGameAudio(audioSettings: AudioSettings) {
  const prevChainLen       = useRef(0);
  const prevUnbanked       = useRef(0);
  const prevGamePhase      = useRef('idle');
  const prevExplosionCount = useRef(0);
  const prevEmotional      = useRef<EmotionalState>('calm');

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
      const unbanked  = state.unbanked;

      // Chain grow
      if (chainLen > prevChainLen.current) {
        resumeCtx();
        playChainAdd(chainLen);
      }

      // Chain commit — chain cleared; check if score increased or farkled
      if (chainLen === 0 && prevChainLen.current > 0) {
        if (unbanked > prevUnbanked.current) {
          playChainCommit(unbanked - prevUnbanked.current);
        } else {
          playFarkle();
        }
        prevUnbanked.current = unbanked;
      }

      // Music control
      if (gamePhase === 'playing') {
        if (audioSettings.ambientEnabled) {
          startAmbientDrone();
          startHeroJourneyTheme();
        }
      } else if (gamePhase !== prevGamePhase.current &&
                 (gamePhase === 'win' || gamePhase === 'lose' || gamePhase === 'idle')) {
        stopAmbientDrone();
        stopHeroJourneyTheme();
      }
      prevGamePhase.current = gamePhase;

      // Emotional conductor — update music profile based on game tension
      const emotional = resolveEmotionalState(chainLen, gamePhase, unbanked);
      if (emotional !== prevEmotional.current) {
        setMusicState(emotional);
        prevEmotional.current = emotional;
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
