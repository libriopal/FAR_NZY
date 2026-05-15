// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Game audio hook — subscribes to store events and triggers sounds.
// TITAN v1.0 — Neural Conductor update:
//   • Hero's Journey theme starts/stops with game phase
//   • Bomb collapse (necrotic) fires when a new explosion enters the store
//   • Collision impulse is estimated from body position velocity between ticks
// ─────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useFarkleStore } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import type { AudioSettings } from '../components/SettingsModal.js';
import {
  resumeCtx, setMasterVolume, setSfxEnabled, setAmbientEnabled,
  playChainAdd, playChainCommit, playFarkle, playBank, playSphereHit,
  playBombBlast, playBombCollapse, playCollisionImpact,
  startAmbientDrone, stopAmbientDrone,
  startHeroJourneyTheme, stopHeroJourneyTheme,
} from '../audio/gameAudio.js';

export function useGameAudio(audioSettings: AudioSettings) {
  const prevChainLen = useRef(0);
  const prevUnbanked = useRef(0);
  const prevGamePhase = useRef('idle');
  const prevExplosionCount = useRef(0);

  // Track previous body positions for collision impulse estimation
  const prevBodyPositions = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());

  useEffect(() => {
    setMasterVolume(audioSettings.masterVolume);
    setSfxEnabled(audioSettings.sfxEnabled);
    setAmbientEnabled(audioSettings.ambientEnabled);
  }, [audioSettings.masterVolume, audioSettings.sfxEnabled, audioSettings.ambientEnabled]);

  // ── Main game state subscriber ─────────────────────────────────────────────
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
        // Find newly added explosion(s)
        const latest = state.explosions[state.explosions.length - 1];
        if (latest) {
          const isRainbow = latest.type === 'rainbow_bomb';
          playBombCollapse(isRainbow);
          // Also play the original blast for layering
          playBombBlast(isRainbow);
        }
      }
      prevExplosionCount.current = count;
    });
    return unsub;
  }, []);

  // ── Collision impulse: bodies position velocity → audio ────────────────────
  // Estimate per-body velocity magnitude from position delta between ticks.
  // High-velocity deltas indicate a physics collision; map magnitude to audio.
  useEffect(() => {
    const unsub = useFarkleStore.subscribe(state => {
      if (state.gamePhase !== 'playing') return;
      const prev = prevBodyPositions.current;
      let maxMag = 0;

      for (const body of state.bodies) {
        const last = prev.get(body.id);
        if (last) {
          const dx = body.position.x - last.x;
          const dy = body.position.y - last.y;
          const dz = body.position.z - last.z;
          const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (mag > maxMag) maxMag = mag;
        }
        prev.set(body.id, { x: body.position.x, y: body.position.y, z: body.position.z });
      }

      // Remove stale entries for bodies that left
      for (const id of Array.from(prev.keys())) {
        if (!state.bodies.find(b => b.id === id)) prev.delete(id);
      }

      // Normalize magnitude: 0.2 world-units/tick ≈ impact threshold
      const normalized = Math.min(1, maxMag / 0.5);
      if (normalized > 0.04) playCollisionImpact(normalized);
    });
    return unsub;
  }, []);

  return { playSphereHit, playBombBlast, playBank };
}
