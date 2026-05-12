// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Physical tray burn-buffer visual component.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import { useTrayStore, TRAY_MAX_SLOTS } from '../store/trayStore.js';
import type { TraySlot } from '../store/trayStore.js';

const FACE_COLOR: Record<number, string> = {
  1: '#f43f5e', 2: '#f97316', 3: '#fbbf24',
  4: '#10b981', 5: '#38bdf8', 6: '#7c3aed',
};

function SlotCell({ slot }: { slot: TraySlot | null }) {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slot || slot.state !== 'burning' || !slot.burnStartAt) return;
    const el = elRef.current;
    if (!el) return;
    const duration = slot.burnDurationMs;
    let raf: number;
    const animate = () => {
      const elapsed = Date.now() - slot.burnStartAt!;
      const t = Math.min(1, elapsed / duration);
      el.style.opacity = String(1 - t * 0.85);
      el.style.transform = `scale(${1 - t * 0.35}) translateY(${t * -6}px)`;
      el.style.filter = `brightness(${1 + t * 1.5}) saturate(${1 + t * 0.5})`;
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [slot?.state, slot?.burnStartAt]);

  const bgColor = slot
    ? slot.entityType === 'sphere' ? '#10b981'
      : slot.entityType === 'wild' ? '#a21caf'
      : slot.entityType === 'bomb' ? '#0a0808'
      : slot.entityType === 'rainbow_bomb' ? '#f0ede0'
      : (FACE_COLOR[slot.face ?? 1] ?? '#4f46e5')
    : 'transparent';

  return (
    <div
      ref={elRef}
      style={{
        width: 36, height: 36, borderRadius: 6,
        background: slot ? bgColor : 'rgba(255,255,255,0.04)',
        border: slot ? `1px solid ${bgColor}88` : '1px dashed #2d1f5e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'monospace',
        transition: slot?.state === 'falling' ? 'transform 0.3s ease-out' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {slot && slot.state === 'burning' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle, rgba(255,140,0,0.6) 0%, transparent 70%)',
          animation: 'ember 0.4s ease-in-out infinite alternate',
        }} />
      )}
      {slot && (
        <span style={{ position: 'relative', zIndex: 1 }}>
          {slot.entityType === 'sphere' ? 'O'
            : slot.entityType === 'wild' ? 'W'
            : slot.entityType === 'bomb' ? 'B'
            : slot.entityType === 'rainbow_bomb' ? 'R'
            : slot.face ?? '?'}
        </span>
      )}
    </div>
  );
}

// Tray slot burn lifecycle — checks each burning slot and clears when done
function useBurnLifecycle() {
  const store = useTrayStore;
  useEffect(() => {
    const interval = setInterval(() => {
      const { slots, clearSlot } = store.getState();
      const now = Date.now();
      for (const slot of slots) {
        if (slot.state === 'burning' && slot.burnStartAt !== null) {
          if (now - slot.burnStartAt >= slot.burnDurationMs) {
            clearSlot(slot.id);
          }
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);
}

export function TrayDisplay() {
  const slots = useTrayStore(s => s.slots);
  const emptyCount = useTrayStore(s => s.getEmptySlotCount());
  useBurnLifecycle();

  // Build display: filled slots first (up to TRAY_MAX_SLOTS), rest empty
  const active = slots.filter(s => s.state !== 'done').slice(0, TRAY_MAX_SLOTS);
  const display: Array<TraySlot | null> = [
    ...active,
    ...Array(Math.max(0, TRAY_MAX_SLOTS - active.length)).fill(null),
  ];

  return (
    <div style={{
      height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '0 12px', background: '#07041a', borderTop: '1px solid #1e1b4b',
      flexShrink: 0,
    }}>
      {display.map((slot, i) => (
        <SlotCell key={slot?.id ?? `empty-${i}`} slot={slot} />
      ))}
      <div style={{ marginLeft: 8, color: '#4f46e5', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, minWidth: 28, textAlign: 'center' }}>
        {emptyCount}/{TRAY_MAX_SLOTS}
      </div>
      <style>{`@keyframes ember { from { opacity: 0.4; } to { opacity: 0.9; } }`}</style>
    </div>
  );
}
