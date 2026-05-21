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
import { blockchainQueue } from '@match3d/blockchain';
import {
  initSupabaseClient,
  signInAnonymous,
  loadPlayerData,
  flushAnalyticsEvents,
  relayBlockchainEntries,
} from '@match3d/backend-client';

// ── Lazy screens ──────────────────────────────────────────────────────────────

const GameScreen = lazy(() => import('./components/GameScreen.js').then(m => ({ default: m.GameScreen })));
const MultiplayerLobby = lazy(() => import('./components/MultiplayerLobby.js').then(m => ({ default: m.MultiplayerLobby })));
const ShopScreen = lazy(() => import('./components/ShopScreen.js').then(m => ({ default: m.ShopScreen })));
const EstateScreen = lazy(() => import('./components/EstateScreen.js').then(m => ({ default: m.EstateScreen })));
const SocialScreen = lazy(() => import('./components/SocialScreen.js').then(m => ({ default: m.SocialScreen })));

// ── Utils ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

function detectPlatform(): string {
  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Capacitor) return 'native';
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ── Per-screen error boundary ─────────────────────────────────────────────────

class ScreenErrorBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh',
          background: '#050008', color: '#e8d5a3',
          fontFamily: 'monospace', padding: 24, textAlign: 'center', gap: 12,
        }}>
          <div style={{ color: '#ff00cc', fontSize: 13, fontWeight: 700 }}>
            {this.props.name.toUpperCase()} CRASHED
          </div>
          <div style={{ color: 'rgba(232,213,163,0.5)', fontSize: 11, maxWidth: 300 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 12, background: 'transparent', border: '1px solid #ff00cc',
              color: '#ff00cc', padding: '10px 24px', fontFamily: 'monospace',
              fontSize: 12, cursor: 'pointer', borderRadius: 3,
            }}
          >RETRY</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { activeScreen, setUserId, setActiveScreen, updateResources } = useGameStore();
  const kycModalOpen = useKYCStore(s => s.modalOpen);
  const [loadProgress, setLoadProgress] = useState(0);

  function goToEntry() {
    const approved = sessionStorage.getItem('compliance_approved');
    setActiveScreen(approved ? 'home' : 'age_gate');
  }

  useEffect(() => {
    let cancelled = false;
    const advance = (n: number) => { if (!cancelled) setLoadProgress(n); };

    async function bootstrap() {
      advance(10);

      try {
        if (SUPABASE_URL && isOnline()) {
          initSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          advance(25);

          try {
            const user = await raceTimeout(signInAnonymous(), 5000);
            if (user && !cancelled) {
              setUserId(user.id);
              try { localStorage.setItem('ff_userId', user.id); } catch {}
              advance(55);

              const sessionId = crypto.randomUUID();
              analytics.configure({
                userId: user.id, sessionId,
                platform: detectPlatform(), appVersion: '1.0.0',
                flushFn: flushAnalyticsEvents,
              });

              // Analytics flush only after compliance approval
              if (sessionStorage.getItem('compliance_approved')) {
                analytics.startAutoFlush();
              }

              analytics.track({
                name: 'session_start',
                props: { userId: user.id, platform: detectPlatform(), appVersion: '1.0.0' },
              });

              // Only wire blockchain relay if network is available
              if (isOnline()) {
                blockchainQueue.setRelayFunction(async entries => {
                  await relayBlockchainEntries(entries);
                  return [];
                });
                blockchainQueue.startAutoFlush();
              }

              try {
                const save = await raceTimeout(loadPlayerData(user.id), 4000);
                if (save?.meta_resources && !cancelled) {
                  updateResources(save.meta_resources as unknown as Parameters<typeof updateResources>[0]);
                }
              } catch { /* non-fatal — use default resources */ }
            }
          } catch (e) {
            console.warn('[App] auth skipped:', String(e));
          }
        }

        advance(88);
        // Let the bar visually complete before transitioning
        await new Promise(r => setTimeout(r, 300));
        advance(100);
        await new Promise(r => setTimeout(r, 120));
        if (!cancelled) goToEntry();
      } catch (e) {
        console.error('[App] bootstrap error:', e);
        if (!cancelled) goToEntry();
      }
    }

    bootstrap();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', userSelect: 'none' }}>
      <DebugOverlay />
      {kycModalOpen && <KYCGate />}
      {activeScreen === 'splash' && <SplashScreen progress={loadProgress} />}
      {activeScreen === 'age_gate' && (
        <ScreenErrorBoundary name="age-gate"><AgeGate /></ScreenErrorBoundary>
      )}
      {activeScreen === 'home' && (
        <ScreenErrorBoundary name="home"><HomeScreen /></ScreenErrorBoundary>
      )}
      {activeScreen === 'game' && (
        <ScreenErrorBoundary name="game">
          <Suspense fallback={<LoadingScreen />}><GameScreen /></Suspense>
        </ScreenErrorBoundary>
      )}
      {activeScreen === 'win' && <WinScreen />}
      {activeScreen === 'lose' && <LoseScreen />}
      {activeScreen === 'multiplayer' && (
        <ScreenErrorBoundary name="multiplayer">
          <Suspense fallback={<LoadingScreen />}><MultiplayerLobby /></Suspense>
        </ScreenErrorBoundary>
      )}
      {activeScreen === 'shop' && (
        <ScreenErrorBoundary name="shop">
          <Suspense fallback={<LoadingScreen />}><ShopScreen /></Suspense>
        </ScreenErrorBoundary>
      )}
      {activeScreen === 'meta' && (
        <ScreenErrorBoundary name="meta">
          <Suspense fallback={<LoadingScreen />}><EstateScreen /></Suspense>
        </ScreenErrorBoundary>
      )}
      {activeScreen === 'social' && (
        <ScreenErrorBoundary name="social">
          <Suspense fallback={<LoadingScreen />}><SocialScreen /></Suspense>
        </ScreenErrorBoundary>
      )}
    </div>
  );
}

// ── Splash ────────────────────────────────────────────────────────────────────

const DOT_FRAMES = ['.', '..', '...', '.', '..', '...'] as const;

function SplashScreen({ progress }: { progress: number }) {
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setDotIdx(i => (i + 1) % 6), 300);
    return () => clearInterval(id);
  }, []);

  const pct = Math.min(100, Math.round(progress));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#050008',
      backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(255,0,204,0.04) 0%, rgba(0,255,255,0.04) 100%)',
      flexDirection: 'column', gap: 20,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 5,
        fontFamily: '"Cinzel", Georgia, serif', display: 'flex', alignItems: 'center',
      }}>
        <span style={{ color: '#ff00cc', textShadow: '0 0 28px rgba(255,0,204,0.8)' }}>MAGENTA DIE</span>
        <span style={{ color: 'rgba(255,255,255,0.25)', margin: '0 10px' }}>&amp;</span>
        <span style={{ color: '#00ffff', textShadow: '0 0 28px rgba(0,255,255,0.8)' }}>CYAN CODE</span>
      </div>

      {/* Progress bar track */}
      <div style={{ width: 220, height: 2, background: 'rgba(0,255,255,0.12)', borderRadius: 1 }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 1,
          background: 'linear-gradient(to right, #ff00cc, #cc00ff)',
          boxShadow: pct > 0 ? '0 0 8px rgba(255,0,204,0.7)' : 'none',
          transition: 'width 0.35s ease',
        }} />
      </div>

      {/* INITIALIZING text — magenta fills left-to-right as progress grows */}
      <div style={{
        fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: 3,
        background: `linear-gradient(to right, #ff00cc ${pct}%, #00ffff ${pct}%)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
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
      color: 'rgba(0,255,255,0.4)', fontFamily: '"JetBrains Mono", monospace',
      fontSize: 11, letterSpacing: 3,
    }}>
      LOADING…
    </div>
  );
}
