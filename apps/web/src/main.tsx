// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

// ── Startup compatibility guards (must run before any other import) ────────────

// crypto.randomUUID() — missing on Android WebView < 92 and some older Samsung
// Browser versions. uuid package falls back to Math.random if this is absent,
// but Capacitor's bridge may also call it directly.
if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  // Minimal RFC-4122 v4 polyfill using crypto.getRandomValues when available
  // Cast through unknown to satisfy the branded UUID template-literal return type
  (crypto as unknown as Record<string, unknown>)['randomUUID'] = function (): string {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6]! & 0x0f) | 0x40;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
}

// ── Pre-render error fallback ──────────────────────────────────────────────────
// Shows a visible error screen if the module graph or variant init fails before
// React is on the page — otherwise the user sees a permanent black screen.
function showFatalError(message: string): void {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;background:#050008;color:#e8d5a3;font-family:monospace;
      padding:24px;text-align:center;gap:12px;">
      <div style="color:#ff00cc;font-size:14px;font-weight:700">SYSTEM ERROR</div>
      <div style="color:rgba(232,213,163,0.5);font-size:11px;max-width:320px">${message}</div>
      <button onclick="window.location.reload()"
        style="margin-top:16px;background:transparent;border:1px solid #c9a84c;
          color:#c9a84c;padding:10px 24px;font-family:monospace;
          font-size:12px;cursor:pointer;border-radius:4px;">
        RESTART
      </button>
    </div>`;
}

// ── Variant init (localStorage may be blocked in restricted WebViews) ─────────
import './styles/bio-architect.css';
import { initVariant } from './styles/variants.js';
try { initVariant(); } catch { /* body attribute fallback already in initVariant */ }

// ── React + App — loaded dynamically so import errors are catchable ───────────
import React from 'react';
import { createRoot } from 'react-dom/client';

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh',
          background: '#050008', color: '#e8d5a3',
          fontFamily: 'monospace', padding: 24, textAlign: 'center', gap: 12,
        }}>
          <div style={{ color: '#ff00cc', fontSize: 14, fontWeight: 700 }}>SYSTEM ERROR</div>
          <div style={{ color: 'rgba(232,213,163,0.5)', fontSize: 11, maxWidth: 320 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, background: 'transparent', border: '1px solid #c9a84c',
              color: '#c9a84c', padding: '10px 24px', fontFamily: 'monospace',
              fontSize: 12, cursor: 'pointer', borderRadius: 4,
            }}
          >
            RESTART
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Debug console bridge (active when VITE_DEBUG_URL is set in .env.local) ────
const DEBUG_URL = (import.meta.env.VITE_DEBUG_URL as string | undefined)?.replace(/\/$/, '');
if (DEBUG_URL) {
  const send = (level: string, args: unknown[]) => {
    const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    fetch(`${DEBUG_URL}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message }),
    }).catch(() => {});
  };
  const orig = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };
  console.log   = (...a) => { orig.log(...a);   send('log',   a); };
  console.warn  = (...a) => { orig.warn(...a);  send('warn',  a); };
  console.error = (...a) => { orig.error(...a); send('error', a); };
  window.addEventListener('error', e => send('error', [e.message, `${e.filename}:${e.lineno}`]));
  window.addEventListener('unhandledrejection', e => send('error', ['unhandled:', String(e.reason)]));
}

async function mount(): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) { showFatalError('Root element not found'); return; }

  try {
    const { default: App } = await import('./App.js');
    createRoot(rootEl).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    );
    document.getElementById('pre-js-loader')?.remove();

    // Hide native splash as soon as React is on screen
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 200 });
    } catch { /* not in Capacitor context */ }
  } catch (e) {
    document.getElementById('pre-js-loader')?.remove();
    showFatalError(e instanceof Error ? e.message : String(e));
  }
}

mount();
