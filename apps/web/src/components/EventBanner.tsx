// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useLiveEvents } from '../hooks/useLiveEvents.js';
import type { LiveEvent } from '../hooks/useLiveEvents.js';

export function EventBanner() {
  const { events, isClaimed, claimEvent } = useLiveEvents();
  const [expanded, setExpanded] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (events.length === 0) return null;

  const unclaimed = events.filter(e => !isClaimed(e));
  const hasUnclaimed = unclaimed.length > 0;

  const handleClaim = async (event: LiveEvent) => {
    if (claiming) return;
    setClaiming(event.id);
    await claimEvent(event);
    setClaiming(null);
    const r = event.reward;
    const parts: string[] = [];
    if (r.goldCoins) parts.push(`+${r.goldCoins} Gold`);
    if (r.sweepsCoins) parts.push(`+${r.sweepsCoins} SC`);
    if (r.bioSteel) parts.push(`+${r.bioSteel} Bio-Steel`);
    setToast(parts.join(' · '));
    setTimeout(() => setToast(null), 2500);
  };

  const formatTimeLeft = (endsAt: number) => {
    const ms = endsAt - Date.now();
    if (ms <= 0) return 'Ended';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)}d left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const EVENT_COLORS: Record<string, { border: string; glow: string; badge: string }> = {
    daily_checkin:  { border: '#1a6fd4', glow: '#1a6fd440', badge: '#1a4080' },
    weekly_featured: { border: '#7c3aed', glow: '#7c3aed40', badge: '#3a1a6a' },
    bonus_weekend:  { border: '#f59e0b', glow: '#f59e0b40', badge: '#4a3000' },
  };

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', background: 'rgba(10,22,40,0.8)',
          border: `1px solid ${hasUnclaimed ? '#1a6fd4' : '#1a3050'}`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', fontFamily: 'monospace',
          boxShadow: hasUnclaimed ? '0 0 12px rgba(26,111,212,0.25)' : 'none',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>🌟</span>
        <span style={{ flex: 1, color: '#7ecfff', fontSize: 13, fontWeight: 700, textAlign: 'left' }}>
          {hasUnclaimed
            ? `${unclaimed.length} reward${unclaimed.length > 1 ? 's' : ''} ready to claim`
            : `${events.length} active event${events.length > 1 ? 's' : ''}`}
        </span>
        {hasUnclaimed && (
          <span style={{
            background: '#1a6fd4', color: '#fff', fontSize: 10,
            borderRadius: 10, padding: '2px 8px', fontWeight: 700,
          }}>
            CLAIM
          </span>
        )}
        <span style={{ color: '#1a4060', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded event cards */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {events.map(event => {
            const colors = EVENT_COLORS[event.type] ?? { border: '#1a6fd4', glow: '#1a6fd440', badge: '#1a4080' };
            const claimed = isClaimed(event);
            return (
              <div key={event.id} style={{
                background: 'rgba(10,22,40,0.9)',
                border: `1px solid ${claimed ? '#1a3050' : colors.border}`,
                borderRadius: 10, padding: '12px 14px',
                boxShadow: claimed ? 'none' : `0 0 10px ${colors.glow}`,
                opacity: claimed ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: 13 }}>
                        {event.title}
                      </span>
                      <span style={{
                        fontSize: 9, background: colors.badge, color: colors.border,
                        borderRadius: 4, padding: '2px 5px',
                      }}>
                        {event.type === 'daily_checkin' ? 'DAILY'
                          : event.type === 'weekly_featured' ? 'WEEKLY' : 'WEEKEND'}
                      </span>
                    </div>
                    <div style={{ color: '#4a7a9a', fontSize: 11, marginBottom: 5 }}>
                      {event.description}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {event.reward.goldCoins > 0 && (
                        <span style={{ color: '#ffd700', fontSize: 11 }}>
                          🟡 +{event.reward.goldCoins}
                        </span>
                      )}
                      {event.reward.sweepsCoins > 0 && (
                        <span style={{ color: '#00e5ff', fontSize: 11 }}>
                          💎 +{event.reward.sweepsCoins}
                        </span>
                      )}
                      {event.reward.bioSteel && event.reward.bioSteel > 0 && (
                        <span style={{ color: '#7ecfff', fontSize: 11 }}>
                          ⚙️ +{event.reward.bioSteel}
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#1a3050', fontSize: 10, marginTop: 4 }}>
                      {formatTimeLeft(event.endsAt)}
                    </div>
                  </div>
                  {!claimed ? (
                    <button
                      onClick={() => handleClaim(event)}
                      disabled={!!claiming}
                      style={{
                        background: claiming === event.id ? '#1a1a2a' : colors.border,
                        border: 'none', color: '#fff',
                        borderRadius: 8, padding: '8px 14px',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'monospace', whiteSpace: 'nowrap',
                        opacity: claiming && claiming !== event.id ? 0.5 : 1,
                      }}
                    >
                      {claiming === event.id ? '...' : 'Claim'}
                    </button>
                  ) : (
                    <span style={{ color: '#1a4060', fontSize: 11 }}>✓ Done</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#1a6fd4', color: '#fff', padding: '10px 24px',
          borderRadius: 24, fontFamily: 'monospace', fontSize: 14,
          boxShadow: '0 4px 20px rgba(26,111,212,0.6)', zIndex: 999,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
