// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles/bio-architect.css';
import { initVariant } from './styles/variants.js';

initVariant();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

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

createRoot(root).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
