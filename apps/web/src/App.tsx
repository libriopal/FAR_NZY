// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, Suspense, lazy } from 'react';
import { useGameStore } from './store/gameStore.js';
import { AgeGate } from './components/AgeGate.js';
import { KYCGate } from './components/KYCGate.js';
import { useKYCStore } from './store/kycStore.js';
import { HomeScreen } from './components/HomeScreen.js';
import { DebugOverlay } from './components/DebugOverlay.js';
import { WinScreen, LoseScreen } from './components/WinLoseScreen.js';
import { analytics } from '@match3d/analytics';
import { blockchainQueue, rngVerifier } from '@match3d/blockchain';
import {
  initSupabaseClient,
  signInAnonymous,
  loadPlayerData,
  flushAnalyticsEvents,
  relayBlockchainEntries,
} from '@match3d/backend-client';
import { v4 as uuidv4 } from 'uuid';

const GameScreen = lazy(() => import('./components/GameScreen.js').then(m => ({ default: m.GameScreen })));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby.js').then(m => ({ default: m.MultiplayerLobby })));
const ShopScreen = lazy(() => import('./components/ShopScreen.js').then(m => ({ default: m.ShopScreen })));
const EstateScreen = lazy(() => import('./components/EstateScreen.js').then(m => ({ default: m.EstateScreen })));
const SocialScreen = lazy(() => import('./components/SocialScreen.js').then(m => ({ default: m.SocialScreen })));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export default function App() {
  const { activeScreen, setUserId, setActiveScreen, updateResources, setCurrentLevel } = useGameStore();
  const kycModalOpen = useKYCStore(s => s.modalOpen);

  useEffect(() => {
    _bootstrap();
  }, []);

  async function _bootstrap() {
    if (SUPABASE_URL) {
      initSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      try {
        const user = await signInAnonymous();
        if (user) {
          setUserId(user.id);
          const sessionId = uuidv4();

          analytics.configure({
            userId: user.id,
            sessionId,
            platform: _detectPlatform(),
            appVersion: '1.0.0',
            flushFn: flushAnalyticsEvents,
          });
          analytics.startAutoFlush();
          analytics.track({ name: 'session_start', props: { userId: user.id, platform: _detectPlatform(), appVersion: '1.0.0' } });

          blockchainQueue.setRelayFunction(async (entries: Parameters<typeof relayBlockchainEntries>[0]) => {
            await relayBlockchainEntries(entries);
            return [];
          });
          blockchainQueue.startAutoFlush();

          const save = await loadPlayerData(user.id);
          if (save?.meta_resources) {
            updateResources(save.meta_resources as unknown as Parameters<typeof updateResources>[0]);
          }
        }
      } catch (e) {
        console.warn('[App] Auth failed, continuing as guest:', e);
      }
    }

    // Skip age gate in dev if already approved
    const approved = sessionStorage.getItem('compliance_approved');
    if (approved) {
      setActiveScreen('home');
    } else {
      setActiveScreen('age_gate');
    }
  }

  // compliance_approved is written only by AgeGate on verified approval — not here

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', userSelect: 'none' }}>
      <DebugOverlay />
      {kycModalOpen && <KYCGate />}
      {activeScreen === 'splash' && <SplashScreen />}
      {activeScreen === 'age_gate' && <AgeGate />}
      {activeScreen === 'home' && <HomeScreen />}
      {activeScreen === 'game' && (
        <Suspense fallback={<LoadingScreen />}>
          <GameScreen />
        </Suspense>
      )}
      {activeScreen === 'win' && <WinScreen />}
      {activeScreen === 'lose' && <LoseScreen />}
      {activeScreen === 'multiplayer' && (
        <Suspense fallback={<LoadingScreen />}><MultiplayerLobby /></Suspense>
      )}
      {activeScreen === 'shop' && (
        <Suspense fallback={<LoadingScreen />}><ShopScreen /></Suspense>
      )}
      {activeScreen === 'meta' && (
        <Suspense fallback={<LoadingScreen />}><EstateScreen /></Suspense>
      )}
      {activeScreen === 'social' && (
        <Suspense fallback={<LoadingScreen />}><SocialScreen /></Suspense>
      )}
    </div>
  );
}

function SplashScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a1628', color: '#7ecfff', fontFamily: 'monospace',
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>🌿</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>The Living Blueprint</div>
      <div style={{ color: '#1a4060', fontSize: 13 }}>Initializing...</div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a1628', color: '#7ecfff', fontFamily: 'monospace',
    }}>
      Loading level...
    </div>
  );
}


function _detectPlatform(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Capacitor) return 'native';
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}
