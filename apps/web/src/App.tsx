// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState, Suspense, lazy } from 'react';
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
    // Fallback: if _bootstrap hangs or throws, always navigate after 6s
    const safetyTimer = window.setTimeout(() => {
      console.warn('[App] bootstrap timeout — forcing age_gate');
      setActiveScreen('age_gate');
    }, 6000);

    _bootstrap().finally(() => window.clearTimeout(safetyTimer));
  }, []);

  async function _bootstrap() {
    try {
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

      // Skip age gate if already approved
      const approved = sessionStorage.getItem('compliance_approved');
      if (approved) {
        setActiveScreen('home');
      } else {
        setActiveScreen('age_gate');
      }
    } catch (e) {
      console.error('[App] bootstrap error:', e);
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
  const DOT_FRAMES = ['.', '..', '...', '.', '..', '...'] as const;
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'splash-kf';
    style.textContent = '@keyframes loadBar{0%{background-position:100% 0}100%{background-position:0% 0}}';
    if (!document.getElementById('splash-kf')) document.head.appendChild(style);
    return () => document.getElementById('splash-kf')?.remove();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setDotIdx(i => (i + 1) % 6), 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#050008',
      backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(255,0,204,0.04) 0%, rgba(0,255,255,0.04) 100%)',
      flexDirection: 'column', gap: 18,
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 5, fontFamily: '"Cinzel", Georgia, serif', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#ff00cc', textShadow: '0 0 28px rgba(255,0,204,0.8)' }}>MAGENTA DIE</span>
        <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 10px' }}>&amp;</span>
        <span style={{ color: '#00ffff', textShadow: '0 0 28px rgba(0,255,255,0.8)' }}>CYAN CODE</span>
      </div>
      <div style={{
        fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: 3,
        background: 'linear-gradient(to left, #00ffff 50%, #ff00cc 50%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: 'loadBar 3s linear infinite',
      } as React.CSSProperties}>
        INITIALIZING{DOT_FRAMES[dotIdx]}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#050008',
      color: 'rgba(232,213,163,0.35)',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11, letterSpacing: 3,
    }}>
      LOADING…
    </div>
  );
}


function _detectPlatform(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Capacitor) return 'native';
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}
