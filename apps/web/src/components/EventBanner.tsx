// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useLiveEvents } from '../hooks/useLiveEvents.js';
import type { LiveEvent } from '../hooks/useLiveEvents.js';
import { OV, TYPE, CURRENCY } from '../theme/tokens.js';

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
    if (r.goldCoins)   parts.push(`+${r.goldCoins} ${CURRENCY.fd.symbol}`);
    if (r.sweepsCoins) parts.push(`+${r.sweepsCoins} ${CURRENCY.pdx.symbol}`);
    if (r.bioSteel)    parts.push(`+${r.bioSteel} SDX`);
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
    daily_checkin:   { border: OV.cyan,    glow: OV.cyanGlow,    badge: 'rgba(0,229,255,0.10)'   },
    weekly_featured: { border: CURRENCY.pdx.color, glow: CURRENCY.pdx.glowColor, badge: 'rgba(123,0,255,0.12)' },
    bonus_weekend:   { border: OV.gold,    glow: OV.goldGlow,    badge: 'rgba(201,168,76,0.10)'  },
  };

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      {/* Collapsed summary bar */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', background: 'rgba(5,0,18,0.88)',
          border: `1px solid ${hasUnclaimed ? OV.cyan : OV.goldDim}`,
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', fontFamily: TYPE.fontCode,
          boxShadow: hasUnclaimed ? `0 0 12px ${OV.cyanGlow}` : 'none',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 14, color: OV.goldBright }}>✦</span>
        <span style={{ flex: 1, color: OV.bone, fontSize: 13, fontWeight: 700, textAlign: 'left' }}>
          {hasUnclaimed
            ? `${unclaimed.length} reward${unclaimed.length > 1 ? 's' : ''} ready to claim`
            : `${events.length} active event${events.length > 1 ? 's' : ''}`}
        </span>
        {hasUnclaimed && (
          <span style={{
            background: OV.cyan, color: OV.void, fontSize: 10,
            borderRadius: 10, padding: '2px 8px', fontWeight: 700,
          }}>
            CLAIM
          </span>
        )}
        <span style={{ color: OV.boneDim, fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded event cards */}
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {events.map(event => {
            const colors = EVENT_COLORS[event.type] ?? { border: OV.cyan, glow: OV.cyanGlow, badge: 'rgba(0,229,255,0.10)' };
            const claimed = isClaimed(event);
            return (
              <div key={event.id} style={{
                background: 'rgba(5,0,18,0.92)',
                border: `1px solid ${claimed ? OV.goldDim : colors.border}`,
                borderRadius: 10, padding: '12px 14px',
                boxShadow: claimed ? 'none' : `0 0 10px ${colors.glow}`,
                opacity: claimed ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: OV.bone, fontWeight: 700, fontSize: 13, fontFamily: TYPE.fontCode }}>
                        {event.title}
                      </span>
                      <span style={{
                        fontSize: 9, background: colors.badge, color: colors.border,
                        borderRadius: 4, padding: '2px 5px', fontFamily: TYPE.fontCode,
                        letterSpacing: 1,
                      }}>
                        {event.type === 'daily_checkin' ? 'DAILY'
                          : event.type === 'weekly_featured' ? 'WEEKLY' : 'WEEKEND'}
                      </span>
                    </div>
                    <div style={{ color: OV.boneDim, fontSize: 11, marginBottom: 5, fontFamily: TYPE.fontCode }}>
                      {event.description}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {event.reward.goldCoins > 0 && (
                        <span style={{ color: OV.goldBright, fontSize: 11, fontFamily: TYPE.fontCode }}>
                          {CURRENCY.fd.symbol} +{event.reward.goldCoins}
                        </span>
                      )}
                      {event.reward.sweepsCoins > 0 && (
                        <span style={{ color: OV.cyan, fontSize: 11, fontFamily: TYPE.fontCode }}>
                          {CURRENCY.pdx.symbol} +{event.reward.sweepsCoins}
                        </span>
                      )}
                      {event.reward.bioSteel && event.reward.bioSteel > 0 && (
                        <span style={{ color: CURRENCY.sdx.lightningColor, fontSize: 11, fontFamily: TYPE.fontCode }}>
                          SDX +{event.reward.bioSteel}
                        </span>
                      )}
                    </div>
                    <div style={{ color: OV.boneDim, fontSize: 10, marginTop: 4, fontFamily: TYPE.fontCode }}>
                      {formatTimeLeft(event.endsAt)}
                    </div>
                  </div>
                  {!claimed ? (
                    <button
                      onClick={() => handleClaim(event)}
                      disabled={!!claiming}
                      style={{
                        background: claiming === event.id ? OV.neural : colors.border,
                        border: 'none', color: claiming === event.id ? OV.boneDim : OV.void,
                        borderRadius: 8, padding: '8px 14px',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: TYPE.fontCode, whiteSpace: 'nowrap',
                        opacity: claiming && claiming !== event.id ? 0.5 : 1,
                      }}
                    >
                      {claiming === event.id ? '···' : 'Claim'}
                    </button>
                  ) : (
                    <span style={{ color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode }}>✓ Done</span>
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
          background: OV.gold, color: OV.void, padding: '10px 24px',
          borderRadius: 24, fontFamily: TYPE.fontCode, fontSize: 14,
          boxShadow: `0 4px 20px ${OV.goldGlow}`, zIndex: 999,
          whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: 1,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
