// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import {
  getLeaderboard,
  getPendingGifts,
  createGuild,
  joinGuild,
  leaveGuild,
  getTopGuilds,
  getGuildLeaderboard,
} from '@match3d/backend-client';
import { OV, TYPE, CURRENCY } from '../theme/tokens.js';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  isMe: boolean;
}

interface GiftItem {
  id: string;
  fromName: string;
  type: string;
  amount: number;
  claimedAt: number | null;
}

type SocialTab = 'leaderboard' | 'gifts' | 'guild';

const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, displayName: 'GreenhouseKing',  score: 982_400, isMe: false },
  { rank: 2, displayName: 'VineWeaver',       score: 875_120, isMe: false },
  { rank: 3, displayName: 'BlueprintMaster',  score: 741_000, isMe: false },
  { rank: 4, displayName: 'You',              score: 0,       isMe: true  },
  { rank: 5, displayName: 'AeroSeedFarmer',   score: 310_800, isMe: false },
];

// Shared filigree loading shimmer — 3 placeholder rows
function FiligreeLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {[1, 0.7, 0.5].map((opacity, i) => (
        <div key={i} style={{
          height: 36, borderRadius: 4,
          background: `rgba(201,168,76,${opacity * 0.07})`,
          border: `1px solid rgba(201,168,76,${opacity * 0.15})`,
          animation: `lbShimmer 1.4s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes lbShimmer {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Shared filigree empty state
function FiligreeEmpty({ label }: { label: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {[3, 5, 8, 5, 3].map((size, i) => (
          <div key={i} style={{
            width: size, height: size,
            background: i === 2 ? OV.goldDim : 'rgba(201,168,76,0.12)',
            transform: 'rotate(45deg)',
            boxShadow: i === 2 ? `0 0 4px ${OV.goldDim}` : 'none',
          }} />
        ))}
      </div>
      <div style={{ color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode, letterSpacing: 2 }}>
        {label}
      </div>
    </div>
  );
}

export function SocialScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const score           = useGameStore(s => s.score);
  const userId          = useGameStore(s => s.userId);
  const [tab, setTab]                   = useState<SocialTab>('leaderboard');
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [gifts, setGifts]               = useState<GiftItem[]>([]);
  const [toast, setToast]               = useState<string | null>(null);
  const [lbLoading, setLbLoading]       = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    setLbLoading(true);
    (async () => {
      try {
        const raw = await getLeaderboard('farkle', 20);
        if (raw && raw.length > 0) {
          const mapped: LeaderboardEntry[] = raw.map((e: Record<string, unknown>, i: number) => {
            const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
            return {
              rank: i + 1,
              displayName: (profile as Record<string, unknown>)?.display_name as string ?? `Player ${i + 1}`,
              score: e.score as number,
              isMe: e.user_id === userId,
            };
          });
          setLeaderboard(mapped);
          setLbLoading(false);
          return;
        }
      } catch { /* fall through to demo */ }
      const demo = DEMO_LEADERBOARD.map(e =>
        e.isMe ? { ...e, score: Math.max(score, e.score) } : e
      ).sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
      setLeaderboard(demo);
      setLbLoading(false);
    })();
  }, [userId, score]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const raw = await getPendingGifts(userId);
        if (raw && raw.length > 0) {
          setGifts(raw.map((g: Record<string, unknown>) => ({
            id:        g.id as string,
            fromName:  'A friend',
            type:      g.gift_type as string,
            amount:    g.amount as number,
            claimedAt: g.claimed_at ? new Date(g.claimed_at as string).getTime() : null,
          })));
        }
      } catch { /* no gifts */ }
    })();
  }, [userId]);

  const claimGift = useCallback((id: string) => {
    setGifts(prev => prev.map(g => g.id === id ? { ...g, claimedAt: Date.now() } : g));
    showToast('Gift claimed!');
  }, [showToast]);

  const TAB_LABELS: Record<SocialTab, string> = {
    leaderboard: 'RANKINGS',
    gifts:       `GIFTS${gifts.filter(g => !g.claimedAt).length > 0 ? ` (${gifts.filter(g => !g.claimedAt).length})` : ''}`,
    guild:       'GUILD',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: OV.void,
      color: OV.bone, fontFamily: TYPE.fontCode, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: `1px solid ${OV.goldDim}`,
        background: 'rgba(13,0,24,0.85)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: OV.goldBright, fontFamily: TYPE.fontDisplay, letterSpacing: 2 }}>
            COMMUNITY HUB
          </div>
          <div style={{ color: OV.boneDim, fontSize: 10, letterSpacing: 1 }}>Rankings · Gifts · Guild</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${OV.goldDim}` }}>
        {(['leaderboard', 'gifts', 'guild'] as SocialTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, background: 'transparent', border: 'none',
            borderBottom: tab === t ? `2px solid ${OV.cyan}` : '2px solid transparent',
            color: tab === t ? OV.cyan : OV.boneDim,
            padding: '12px 0',
            fontFamily: TYPE.fontCode, fontSize: 10, cursor: 'pointer',
            letterSpacing: 2, textTransform: 'uppercase',
            textShadow: tab === t ? `0 0 6px ${OV.cyanGlow}` : 'none',
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ padding: 20, flex: 1 }}>
        {tab === 'leaderboard' && (lbLoading
          ? <FiligreeLoading />
          : <LeaderboardPanel entries={leaderboard} />
        )}
        {tab === 'gifts' && <GiftsPanel gifts={gifts} onClaim={claimGift} />}
        {tab === 'guild' && <GuildPanel />}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: OV.gold, color: OV.void, padding: '10px 24px',
          borderRadius: 20, fontFamily: TYPE.fontCode, fontSize: 13,
          boxShadow: `0 4px 20px ${OV.goldGlow}`, zIndex: 999,
          fontWeight: 700, letterSpacing: 1,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function LeaderboardPanel({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <FiligreeEmpty label="RANKINGS LOADING — CHECK BACK SOON" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: OV.boneDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
        Weekly Rankings
      </div>
      {entries.map(e => {
        const rankColor = e.rank === 1 ? OV.goldBright : e.rank === 2 ? '#c0c0c0' : e.rank === 3 ? '#cd7f32' : OV.boneDim;
        return (
          <div key={e.rank} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(13,0,24,0.85)',
            border: `1px solid ${e.isMe ? OV.cyan : OV.cyanGlow}`,
            borderRadius: 8, padding: '12px 16px',
            boxShadow: e.isMe ? `0 0 8px ${OV.cyanGlow}` : 'none',
          }}>
            <div style={{ width: 28, textAlign: 'center', fontWeight: 700, color: rankColor, fontSize: 12 }}>
              {e.rank <= 3 ? ['✦', '✧', '◆'][e.rank - 1] : `#${e.rank}`}
            </div>
            <div style={{ flex: 1, fontWeight: e.isMe ? 700 : 400, color: OV.bone, fontSize: 13 }}>
              {e.displayName}{e.isMe ? ' (you)' : ''}
            </div>
            <div style={{ color: OV.cyan, fontSize: 13, fontWeight: 700, textShadow: `0 0 6px ${OV.cyanGlow}` }}>
              {e.score.toLocaleString()}
            </div>
          </div>
        );
      })}
      <p style={{ color: 'rgba(232,213,163,0.18)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
        Rankings reset weekly. Play to improve your position.
      </p>
    </div>
  );
}

function GiftsPanel({ gifts, onClaim }: { gifts: GiftItem[]; onClaim: (id: string) => void }) {
  const unclaimed = gifts.filter(g => !g.claimedAt).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: OV.boneDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
        Inbox ({unclaimed} unclaimed)
      </div>
      {gifts.length === 0 ? (
        <FiligreeEmpty label="NO GIFTS YET — CONNECT WITH ALLIES" />
      ) : gifts.map(g => (
        <div key={g.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(13,0,24,0.85)',
          border: `1px solid ${g.claimedAt ? OV.goldDim : OV.cyanGlow}`,
          borderRadius: 8, padding: '12px 16px',
          opacity: g.claimedAt ? 0.5 : 1,
        }}>
          <div style={{ fontSize: 18, color: OV.gold, textShadow: `0 0 6px ${OV.goldGlow}` }}>◈</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: OV.bone }}>{g.fromName}</div>
            <div style={{ color: OV.cyan, fontSize: 11 }}>+{g.amount} {g.type}</div>
          </div>
          {!g.claimedAt ? (
            <button onClick={() => onClaim(g.id)} style={{
              background: OV.gold, border: 'none', color: OV.void,
              borderRadius: 6, padding: '8px 16px', fontSize: 12,
              cursor: 'pointer', fontFamily: TYPE.fontCode, fontWeight: 700,
              boxShadow: `0 0 8px ${OV.goldGlow}`,
            }}>
              CLAIM
            </button>
          ) : (
            <span style={{ color: OV.boneDim, fontSize: 10 }}>✓ Claimed</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface TopGuild {
  id: string; name: string; tag: string;
  member_count: number; weekly_score: number;
}

interface GuildMember {
  user_id: string; weekly_contribution: number;
  profiles: { display_name: string } | null;
}

type GuildView = 'main' | 'browse' | 'create' | 'detail';

const DEMO_TOP_GUILDS: TopGuild[] = [
  { id: 'g1', name: 'Blueprint Collective', tag: 'BLUP', member_count: 24, weekly_score: 1_240_000 },
  { id: 'g2', name: 'Glass & Vine',         tag: 'GLAS', member_count: 18, weekly_score: 987_000   },
  { id: 'g3', name: 'Aero Pioneers',        tag: 'AERO', member_count: 31, weekly_score: 720_500   },
];

function GuildPanel() {
  const userId = useGameStore(s => s.userId);
  const [view, setView]               = useState<GuildView>('main');
  const [myGuildId, setMyGuildId]     = useState<string | null>(null);
  const [topGuilds, setTopGuilds]     = useState<TopGuild[]>([]);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<TopGuild | null>(null);
  const [createName, setCreateName]   = useState('');
  const [createTag, setCreateTag]     = useState('');
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  const loadTopGuilds = useCallback(async () => {
    try {
      const data = await getTopGuilds(20);
      setTopGuilds(data.length > 0 ? data : DEMO_TOP_GUILDS);
    } catch {
      setTopGuilds(DEMO_TOP_GUILDS);
    }
  }, []);

  useEffect(() => { loadTopGuilds(); }, [loadTopGuilds]);

  const handleCreate = useCallback(async () => {
    if (!createName.trim() || !createTag.trim()) return;
    setBusy(true); setErr(null);
    try {
      const guild = await createGuild(createName.trim(), createTag.trim());
      setMyGuildId(guild.id);
      setView('main');
      setCreateName(''); setCreateTag('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create guild');
    } finally { setBusy(false); }
  }, [createName, createTag]);

  const handleJoin = useCallback(async (guild: TopGuild) => {
    setBusy(true); setErr(null);
    try {
      await joinGuild(guild.id);
      setMyGuildId(guild.id);
      setView('main');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to join guild');
    } finally { setBusy(false); }
  }, []);

  const handleLeave = useCallback(async () => {
    if (!myGuildId) return;
    setBusy(true);
    try { await leaveGuild(myGuildId); setMyGuildId(null); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }, [myGuildId]);

  const openDetail = useCallback(async (guild: TopGuild) => {
    setSelectedGuild(guild);
    setView('detail');
    try {
      const members = await getGuildLeaderboard(guild.id);
      setGuildMembers(members);
    } catch { setGuildMembers([]); }
  }, []);

  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setView('main')} style={guildBackBtnStyle}>← Back</button>
          <span style={{ color: OV.goldBright, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>CREATE GUILD</span>
        </div>
        <input value={createName} onChange={e => setCreateName(e.target.value)}
          placeholder="Guild name (max 30 chars)"
          style={{ ...inputStyle, width: '100%' }} maxLength={30} />
        <input value={createTag} onChange={e => setCreateTag(e.target.value.toUpperCase())}
          placeholder="Tag (max 4 chars, e.g. BLUP)"
          style={{ ...inputStyle, width: '100%' }} maxLength={4} />
        {err && <div style={{ color: OV.magenta, fontSize: 12 }}>{err}</div>}
        <button onClick={handleCreate} disabled={busy || !createName.trim() || !createTag.trim()} style={guildActionBtnStyle}>
          {busy ? 'Creating...' : 'CREATE GUILD'}
        </button>
      </div>
    );
  }

  if (view === 'detail' && selectedGuild) {
    const myGuild = selectedGuild.id === myGuildId;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setView('browse')} style={guildBackBtnStyle}>← Back</button>
          <span style={{ color: OV.cyan, fontWeight: 700, fontSize: 12 }}>
            [{selectedGuild.tag}] {selectedGuild.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: OV.boneDim, fontSize: 11 }}>{selectedGuild.member_count} members</span>
          <span style={{ color: OV.gold, fontSize: 11 }}>Weekly: {selectedGuild.weekly_score.toLocaleString()}</span>
        </div>
        {guildMembers.length === 0 ? (
          <FiligreeEmpty label="NO MEMBER DATA YET" />
        ) : guildMembers.map((m, i) => (
          <div key={m.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(13,0,24,0.85)',
            border: `1px solid ${OV.cyanGlow}`,
            borderRadius: 6, padding: '10px 14px',
          }}>
            <span style={{ color: OV.cyan, width: 22, fontSize: 11 }}>#{i + 1}</span>
            <span style={{ flex: 1, color: OV.bone, fontSize: 13 }}>
              {m.profiles?.display_name ?? m.user_id.slice(0, 8)}
            </span>
            <span style={{ color: OV.gold, fontSize: 11 }}>
              {m.weekly_contribution.toLocaleString()}
            </span>
          </div>
        ))}
        {!myGuild && (
          <button onClick={() => handleJoin(selectedGuild)} disabled={busy} style={guildActionBtnStyle}>
            {busy ? '...' : 'JOIN GUILD'}
          </button>
        )}
        {myGuild && (
          <button onClick={handleLeave} disabled={busy} style={{
            ...guildActionBtnStyle,
            background: 'rgba(255,0,204,0.12)',
            border: `1px solid ${OV.magenta}`,
            color: OV.magentaBright,
            boxShadow: `0 0 8px ${OV.magentaGlow}`,
          }}>
            {busy ? '...' : 'LEAVE GUILD'}
          </button>
        )}
      </div>
    );
  }

  if (view === 'browse') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button onClick={() => setView('main')} style={guildBackBtnStyle}>← Back</button>
          <span style={{ color: OV.goldBright, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>TOP GUILDS</span>
        </div>
        {topGuilds.length === 0 ? (
          <FiligreeEmpty label="NO GUILDS FOUND" />
        ) : topGuilds.map((g, i) => (
          <div key={g.id} onClick={() => openDetail(g)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(13,0,24,0.85)',
            border: `1px solid ${OV.cyanGlow}`,
            borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
          }}>
            <div style={{ color: OV.cyan, fontWeight: 700, width: 24, fontSize: 11 }}>#{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: OV.bone, fontSize: 13 }}>[{g.tag}] {g.name}</div>
              <div style={{ color: OV.boneDim, fontSize: 11 }}>{g.member_count} members</div>
            </div>
            <div style={{ color: OV.gold, fontSize: 12 }}>{g.weekly_score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    );
  }

  // Main guild view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {myGuildId ? (
        <div style={{
          background: 'rgba(13,0,24,0.85)',
          border: `1px solid ${OV.cyan}`,
          borderRadius: 10, padding: 16,
          boxShadow: `0 0 12px ${OV.cyanGlow}`,
        }}>
          <div style={{ color: OV.cyan, fontWeight: 700, marginBottom: 6, letterSpacing: 2, fontSize: 12 }}>
            YOUR GUILD
          </div>
          <div style={{ color: OV.boneDim, fontSize: 11, marginBottom: 10 }}>
            ID: {myGuildId.slice(0, 8)}…
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setSelectedGuild(topGuilds.find(g => g.id === myGuildId) ?? null); setView('detail'); }} style={guildBackBtnStyle}>
              View Details
            </button>
            <button onClick={handleLeave} disabled={busy} style={{
              ...guildActionBtnStyle,
              background: 'rgba(255,0,204,0.12)',
              border: `1px solid ${OV.magenta}`,
              color: OV.magentaBright,
              boxShadow: 'none',
            }}>
              {busy ? '...' : 'Leave'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(13,0,24,0.85)',
          border: `1px solid ${OV.goldDim}`,
          borderRadius: 10, padding: 24, textAlign: 'center',
        }}>
          {/* Filigree empty state — no guild */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            {[3, 5, 8, 5, 3].map((size, i) => (
              <div key={i} style={{
                width: size, height: size,
                background: i === 2 ? OV.goldDim : 'rgba(201,168,76,0.12)',
                transform: 'rotate(45deg)',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: OV.goldBright, marginBottom: 4, letterSpacing: 2 }}>
            NO GUILD
          </div>
          <div style={{ color: OV.boneDim, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
            Join a guild to earn bonus {CURRENCY.pdx.symbol} and compete in weekly events.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setView('create')} style={guildActionBtnStyle}>Create</button>
            <button onClick={() => setView('browse')} style={guildBackBtnStyle}>Browse</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: OV.neural,
  border: `1px solid ${OV.goldDim}`,
  color: OV.bone, borderRadius: 6, padding: '10px 14px',
  fontSize: 12, fontFamily: TYPE.fontCode, outline: 'none',
};

const guildActionBtnStyle: React.CSSProperties = {
  background: OV.gold, border: 'none', color: OV.void,
  borderRadius: 6, padding: '10px 20px',
  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: TYPE.fontCode,
  letterSpacing: 2, boxShadow: `0 0 8px ${OV.goldGlow}`,
};

const guildBackBtnStyle: React.CSSProperties = {
  background: 'rgba(13,0,24,0.85)',
  border: `1px solid ${OV.goldDim}`, color: OV.bone,
  borderRadius: 6, padding: '10px 20px',
  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: TYPE.fontCode,
};

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${OV.goldDim}`, color: OV.gold,
  borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: TYPE.fontCode, fontSize: 16,
};
