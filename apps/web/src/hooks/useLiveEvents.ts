// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useEconomy } from './useEconomy.js';
import { analytics } from '@match3d/analytics';
import { savePlayerData } from '@match3d/backend-client';

export interface LiveEvent {
  id: string;
  type: 'daily_checkin' | 'weekly_featured' | 'bonus_weekend' | 'seasonal_challenge';
  title: string;
  description: string;
  reward: { goldCoins: number; sweepsCoins: number; bioSteel?: number };
  startsAt: number;
  endsAt: number;
  claimKey: string; // localStorage key for claim state
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function getEventWindow(baseMs: number, durationMs: number) {
  const now = Date.now();
  const start = Math.floor(now / baseMs) * baseMs;
  return { startsAt: start, endsAt: start + durationMs };
}

function buildEvents(): LiveEvent[] {
  const dailyWindow = getEventWindow(DAY_MS, DAY_MS);
  const weeklyWindow = getEventWindow(WEEK_MS, WEEK_MS);
  const now = Date.now();

  const events: LiveEvent[] = [
    {
      id: 'daily_checkin',
      type: 'daily_checkin',
      title: 'Daily Blueprint Bonus',
      description: 'Claim your daily resources to expand the greenhouse.',
      reward: { goldCoins: 250, sweepsCoins: 5, bioSteel: 10 },
      ...dailyWindow,
      claimKey: `claimed_daily_${dailyWindow.startsAt}`,
    },
    {
      id: 'weekly_featured',
      type: 'weekly_featured',
      title: 'Featured: Glass Harvest',
      description: 'This week only — double rewards for structural matches.',
      reward: { goldCoins: 1000, sweepsCoins: 25 },
      ...weeklyWindow,
      claimKey: `claimed_weekly_${weeklyWindow.startsAt}`,
    },
  ];

  // Bonus weekend: Friday 18:00 → Sunday 23:59 UTC
  const d = new Date(now);
  const day = d.getUTCDay(); // 0=Sun,5=Fri,6=Sat
  if (day === 5 || day === 6 || day === 0) {
    const fridayBase = now - ((day === 5 ? 0 : day === 6 ? 1 : 2) * DAY_MS);
    const fridayStart = new Date(fridayBase);
    fridayStart.setUTCHours(18, 0, 0, 0);
    const endTime = fridayStart.getTime() + 2.25 * DAY_MS;
    if (now < endTime) {
      events.push({
        id: 'bonus_weekend',
        type: 'bonus_weekend',
        title: 'Weekend Bloom Event',
        description: 'Earn 2× Sweeps Coins on all wins this weekend.',
        reward: { goldCoins: 500, sweepsCoins: 50 },
        startsAt: fridayStart.getTime(),
        endsAt: endTime,
        claimKey: `claimed_weekend_${fridayStart.getTime()}`,
      });
    }
  }

  // Seasonal challenge: active first 7 days of each month, score-threshold unlock
  const d2 = new Date(now);
  if (d2.getUTCDate() <= 7) {
    const monthStart = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), 1)).getTime();
    const monthEnd = monthStart + 7 * DAY_MS;
    events.push({
      id: 'seasonal_challenge',
      type: 'seasonal_challenge',
      title: 'Monthly Blueprint Challenge',
      description: 'Reach 50,000 pts in a single run to unlock bonus rewards.',
      reward: { goldCoins: 2000, sweepsCoins: 100, bioSteel: 50 },
      startsAt: monthStart,
      endsAt: monthEnd,
      claimKey: `claimed_seasonal_${monthStart}`,
    });
  }

  return events;
}

export function useLiveEvents() {
  const userId = useGameStore(s => s.userId);
  const updateResources = useGameStore(s => s.updateResources);
  const resources = useGameStore(s => s.resources);
  const { creditReward } = useEconomy();

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEvents(buildEvents());
    // Load persisted claims from localStorage
    const stored = Object.keys(localStorage).filter(k => k.startsWith('claimed_'));
    setClaimedKeys(new Set(stored));

    // Refresh event list every minute (timer ticks, weekends end, etc.)
    const iv = setInterval(() => setEvents(buildEvents()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const isClaimed = useCallback(
    (event: LiveEvent) => claimedKeys.has(event.claimKey),
    [claimedKeys],
  );

  const claimEvent = useCallback(async (event: LiveEvent) => {
    if (isClaimed(event)) return;
    localStorage.setItem(event.claimKey, String(Date.now()));
    setClaimedKeys(prev => new Set([...prev, event.claimKey]));

    // Persist claim to Supabase (dual write; non-blocking)
    if (userId) {
      const storedClaims = Object.keys(localStorage)
        .filter(k => k.startsWith('claimed_'))
        .reduce<Record<string, string>>((acc, k) => { acc[k] = localStorage.getItem(k) ?? ''; return acc; }, {});
      savePlayerData(userId, { settings: { event_claims: storedClaims } }).catch(() => {});
    }

    // Credit economy
    if (event.reward.goldCoins > 0) {
      await creditReward('daily_bonus', 'goldCoins', event.reward.goldCoins, { eventId: event.id });
    }
    if (event.reward.sweepsCoins > 0) {
      await creditReward('sweeps_award', 'sweepsCoins', event.reward.sweepsCoins, { eventId: event.id });
    }
    // Credit meta resources
    if (event.reward.bioSteel && event.reward.bioSteel > 0) {
      updateResources({ ...resources, bioSteel: resources.bioSteel + event.reward.bioSteel });
    }

    analytics.track({
      name: 'ad_reward_claimed',
      props: {
        rewardType: event.type,
        goldCoins: event.reward.goldCoins,
        sweepsCoins: event.reward.sweepsCoins,
      },
    });
  }, [isClaimed, creditReward, updateResources, resources]);

  const activeEvents = events.filter(e => Date.now() < e.endsAt);
  const hasUnclaimed = activeEvents.some(e => !isClaimed(e));

  return { events: activeEvents, isClaimed, claimEvent, hasUnclaimed };
}
