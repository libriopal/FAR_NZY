// ─────────────────────────────────────────────────────
// DEBUG OVERLAY — touch logger
// Small beetle icon, top-right corner. Toggleable.
// ON:  records all pointer/touch events + shows live red log in corner.
// OFF: hides log, saves full log to a .txt file for analysis.
// Remove from App.tsx before shipping.
// ─────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface LogEntry {
  t: number;       // ms since tracking started
  wall: string;    // HH:MM:SS.mmm
  type: string;
  x: number;
  y: number;
  target: string;
  extra: string;
}

function wallTime(epoch: number): string {
  const d = new Date(epoch);
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':') + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function describeTarget(el: EventTarget | null): string {
  if (!el || !(el instanceof Element)) return '?';
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  const txt = el.textContent?.trim().slice(0, 20);
  if (txt) s += `:"${txt}"`;
  return s;
}

const BeetleSVG = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={active ? '#ef4444' : 'rgba(255,255,255,0.45)'}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="13" rx="5" ry="7" />
    <circle cx="12" cy="5.5" r="2.5" />
    <line x1="10.5" y1="3.5" x2="7" y2="1" />
    <line x1="13.5" y1="3.5" x2="17" y2="1" />
    <line x1="7" y1="10" x2="3" y2="8" />
    <line x1="7" y1="13" x2="3" y2="13" />
    <line x1="7" y1="16" x2="3" y2="18" />
    <line x1="17" y1="10" x2="21" y2="8" />
    <line x1="17" y1="13" x2="21" y2="13" />
    <line x1="17" y1="16" x2="21" y2="18" />
    <line x1="12" y1="6.5" x2="12" y2="20" />
  </svg>
);

const MAX_DISPLAY = 40;   // lines visible in the live log panel
const MAX_STORED  = 5000; // max entries kept in memory

export function DebugOverlay() {
  const [active, setActive] = useState(false);
  const logRef  = useRef<LogEntry[]>([]);
  const startRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Displayed lines — kept in state so React re-renders them
  const [lines, setLines] = useState<string[]>([]);

  const appendEntry = useCallback((entry: LogEntry) => {
    const log = logRef.current;
    if (log.length >= MAX_STORED) log.shift();
    log.push(entry);

    // Update live display (last MAX_DISPLAY lines)
    setLines(
      log.slice(-MAX_DISPLAY).map(e =>
        `+${String(e.t).padStart(5)}ms ${e.type.padEnd(13)} ${e.x},${e.y} → ${e.target}`
      )
    );
  }, []);

  // Start / stop tracking
  useEffect(() => {
    if (!active) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      return;
    }

    logRef.current = [];
    startRef.current = Date.now();
    setLines([]);

    const EVENT_TYPES = [
      'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
      'touchstart', 'touchend', 'touchmove', 'touchcancel',
      'click',
    ];

    const handler = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('[data-debug-beetle]')) return;
      const pe = e as PointerEvent;
      const now = Date.now();
      appendEntry({
        t: now - startRef.current,
        wall: wallTime(now),
        type: e.type,
        x: Math.round(pe.clientX ?? 0),
        y: Math.round(pe.clientY ?? 0),
        target: describeTarget(e.target),
        extra: `p=${pe.pressure?.toFixed(2) ?? '-'}`,
      });
    };

    for (const t of EVENT_TYPES) {
      document.addEventListener(t, handler, { capture: true, passive: true });
    }

    cleanupRef.current = () => {
      for (const t of EVENT_TYPES) {
        document.removeEventListener(t, handler, { capture: true });
      }
    };

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [active, appendEntry]);

  // Save log to file when toggling OFF
  const handleToggle = useCallback(() => {
    if (active) {
      // Save file first, then deactivate
      const entries = logRef.current;
      if (entries.length > 0) {
        const header = [
          '# MATCH3D Touch Debug Log',
          `# Session start: ${new Date(startRef.current).toISOString()}`,
          `# Total events:  ${entries.length}`,
          `# Columns: +relMs  type  x,y  →  target`,
          '',
        ].join('\n');

        const body = entries.map(e =>
          `${wallTime(startRef.current + e.t)}  +${String(e.t).padStart(6)}ms  ` +
          `${e.type.padEnd(14)} ${String(e.x).padStart(4)},${String(e.y).padStart(4)}  ` +
          `${e.extra}  →  ${e.target}`
        ).join('\n');

        const blob = new Blob([header + body], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date(startRef.current).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.href = url;
        a.download = `match3d-touch-${stamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
    setActive(v => !v);
  }, [active]);

  return (
    <>
      {/* Beetle toggle button */}
      <div
        data-debug-beetle
        onClick={handleToggle}
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 999999,
          width: 32,
          height: 32,
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${active ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
          cursor: 'pointer',
          touchAction: 'manipulation',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        title={active ? 'Stop logging & save file' : 'Start touch logging'}
      >
        <BeetleSVG active={active} />
      </div>

      {/* Live log panel — only visible while active */}
      {active && lines.length > 0 && (
        <div
          data-debug-beetle
          style={{
            position: 'fixed',
            top: 48,
            right: 8,
            zIndex: 999998,
            maxWidth: 280,
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: 8,
            lineHeight: 1.35,
            color: 'rgba(239,68,68,0.75)',
            textAlign: 'right',
            textShadow: '0 0 4px rgba(0,0,0,0.9)',
            wordBreak: 'break-all',
          }}
        >
          {lines.map((l, i) => (
            <div key={i} style={{ opacity: 0.4 + 0.6 * (i / lines.length) }}>
              {l}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
