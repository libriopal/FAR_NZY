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
  { rank: 1, displayName: 'GreenhouseKing', score: 982_400, isMe: false },
  { rank: 2, displayName: 'VineWeaver', score: 875_120, isMe: false },
  { rank: 3, displayName: 'BlueprintMaster', score: 741_000, isMe: false },
  { rank: 4, displayName: 'You', score: 0, isMe: true },
  { rank: 5, displayName: 'AeroSeedFarmer', score: 310_800, isMe: false },
];

export function SocialScreen() {
  const setActiveScreen = useGameStore(s => s.setActiveScreen);
  const score = useGameStore(s => s.score);
  const userId = useGameStore(s => s.userId);
  const [tab, setTab] = useState<SocialTab>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
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
          return;
        }
      } catch { /* fall through to demo */ }
      const demo = DEMO_LEADERBOARD.map(e =>
        e.isMe ? { ...e, score: Math.max(score, e.score) } : e
      ).sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
      setLeaderboard(demo);
    })();
  }, [userId, score]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const raw = await getPendingGifts(userId);
        if (raw && raw.length > 0) {
          setGifts(raw.map((g: Record<string, unknown>) => ({
            id: g.id as string,
            fromName: 'A friend',
            type: g.gift_type as string,
            amount: g.amount as number,
            claimedAt: g.claimed_at ? new Date(g.claimed_at as string).getTime() : null,
          })));
        }
      } catch { /* no gifts or not connected */ }
    })();
  }, [userId]);

  const claimGift = useCallback((id: string) => {
    setGifts(prev => prev.map(g => g.id === id ? { ...g, claimedAt: Date.now() } : g));
    showToast('Gift claimed!');
  }, [showToast]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100vh',
      background: 'var(--ba-surface-bg)',
      color: 'var(--ba-marble-200)', fontFamily: 'monospace', overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid var(--ba-glass-border)',
        background: 'var(--ba-glass-bg)',
        backdropFilter: 'var(--ba-glass-blur)', WebkitBackdropFilter: 'var(--ba-glass-blur)',
      }}>
        <button onClick={() => setActiveScreen('home')} style={backBtnStyle}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ba-accent)' }}>Greenhouse Community</div>
          <div style={{ color: 'var(--ba-marble-500)', fontSize: 11 }}>Leaderboards · Gifts · Guild</div>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--ba-glass-border)' }}>
        {(['leaderboard', 'gifts', 'guild'] as SocialTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, background: 'transparent', border: 'none',
            borderBottom: tab === t ? '2px solid var(--ba-accent)' : '2px solid transparent',
            color: tab === t ? 'var(--ba-accent)' : 'var(--ba-marble-500)', padding: '12px 0',
            fontFamily: 'monospace', fontSize: 13, cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {t === 'leaderboard' ? '🏆 Board' : t === 'gifts' ? `🎁 Gifts${gifts.filter(g => !g.claimedAt).length > 0 ? ` (${gifts.filter(g => !g.claimedAt).length})` : ''}` : '⚔ Guild'}
          </button>
        ))}
      </div>

      <div style={{ padding: 20, flex: 1 }}>
        {tab === 'leaderboard' && <LeaderboardPanel entries={leaderboard} />}
        {tab === 'gifts' && <GiftsPanel gifts={gifts} onClaim={claimGift} />}
        {tab === 'guild' && <GuildPanel />}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ba-accent)', color: '#fff', padding: '10px 24px',
          borderRadius: 24, fontFamily: 'monospace', fontSize: 14,
          boxShadow: '0 4px 20px var(--ba-accent-glow)', zIndex: 999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function LeaderboardPanel({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <div style={{ color: 'var(--ba-marble-800)', textAlign: 'center', padding: 48 }}>Loading rankings...</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Weekly Rankings
      </div>
      {entries.map(e => (
        <div key={e.rank} className="ba-glass" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${e.isMe ? 'var(--ba-accent)' : 'var(--ba-card-border)'}`,
          borderRadius: 10, padding: '12px 16px',
          boxShadow: e.isMe ? '0 0 8px var(--ba-accent-glow)' : 'none',
        }}>
          <div style={{
            width: 28, textAlign: 'center', fontWeight: 700,
            color: e.rank === 1 ? 'var(--ba-glow-amber)' : e.rank === 2 ? '#c0c0c0' : e.rank === 3 ? '#cd7f32' : 'var(--ba-marble-500)',
          }}>
            {e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : `#${e.rank}`}
          </div>
          <div style={{ flex: 1, fontWeight: e.isMe ? 700 : 400, color: 'var(--ba-marble-200)' }}>
            {e.displayName}{e.isMe ? ' (you)' : ''}
          </div>
          <div style={{ color: 'var(--ba-accent)', fontSize: 14, fontWeight: 700 }}>
            {e.score.toLocaleString()}
          </div>
        </div>
      ))}
      <p style={{ color: 'var(--ba-marble-800)', fontSize: 10, marginTop: 8, textAlign: 'center' }}>
        Rankings reset weekly. Play to improve your position.
      </p>
    </div>
  );
}

function GiftsPanel({ gifts, onClaim }: { gifts: GiftItem[]; onClaim: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: 'var(--ba-marble-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        Inbox ({gifts.filter(g => !g.claimedAt).length} unclaimed)
      </div>
      {gifts.length === 0 && (
        <div style={{ color: 'var(--ba-marble-800)', textAlign: 'center', padding: 32 }}>No gifts yet.</div>
      )}
      {gifts.map(g => (
        <div key={g.id} className="ba-glass" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${g.claimedAt ? 'var(--ba-glass-border)' : 'var(--ba-card-border)'}`,
          borderRadius: 10, padding: '12px 16px',
          opacity: g.claimedAt ? 0.5 : 1,
        }}>
          <div style={{ fontSize: 20 }}>🎁</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ba-marble-200)' }}>{g.fromName}</div>
            <div style={{ color: 'var(--ba-accent)', fontSize: 12 }}>+{g.amount} {g.type}</div>
          </div>
          {!g.claimedAt ? (
            <button onClick={() => onClaim(g.id)} style={{
              background: 'var(--ba-accent)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
            }}>
              Claim
            </button>
          ) : (
            <span style={{ color: 'var(--ba-marble-800)', fontSize: 11 }}>✓ Claimed</span>
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
  { id: 'g2', name: 'Glass & Vine', tag: 'GLAS', member_count: 18, weekly_score: 987_000 },
  { id: 'g3', name: 'Aero Pioneers', tag: 'AERO', member_count: 31, weekly_score: 720_500 },
];

function GuildPanel() {
  const userId = useGameStore(s => s.userId);
  const [view, setView] = useState<GuildView>('main');
  const [myGuildId, setMyGuildId] = useState<string | null>(null);
  const [topGuilds, setTopGuilds] = useState<TopGuild[]>([]);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<TopGuild | null>(null);
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    try {
      await leaveGuild(myGuildId);
      setMyGuildId(null);
    } catch { /* ignore */ }
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
          <span style={{ color: 'var(--ba-accent)', fontWeight: 700 }}>Create Guild</span>
        </div>
        <input
          value={createName} onChange={e => setCreateName(e.target.value)}
          placeholder="Guild name (max 30 chars)"
          style={{ ...inputStyle, width: '100%' }}
          maxLength={30}
        />
        <input
          value={createTag} onChange={e => setCreateTag(e.target.value.toUpperCase())}
          placeholder="Tag (max 4 chars, e.g. BLUP)"
          style={{ ...inputStyle, width: '100%' }}
          maxLength={4}
        />
        {err && <div style={{ color: 'var(--ba-danger)', fontSize: 12 }}>{err}</div>}
        <button onClick={handleCreate} disabled={busy || !createName.trim() || !createTag.trim()} style={guildActionBtnStyle}>
          {busy ? 'Creating...' : 'Create Guild'}
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
          <span style={{ color: 'var(--ba-accent)', fontWeight: 700 }}>[{selectedGuild.tag}] {selectedGuild.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--ba-marble-500)', fontSize: 12 }}>{selectedGuild.member_count} members</span>
          <span style={{ color: 'var(--ba-accent)', fontSize: 12 }}>Weekly: {selectedGuild.weekly_score.toLocaleString()}</span>
        </div>
        {guildMembers.map((m, i) => (
          <div key={m.user_id} className="ba-glass" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            border: '1px solid var(--ba-card-border)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <span style={{ color: 'var(--ba-accent)', width: 22, fontSize: 12 }}>#{i + 1}</span>
            <span style={{ flex: 1, color: 'var(--ba-marble-200)', fontSize: 13 }}>{m.profiles?.display_name ?? m.user_id.slice(0, 8)}</span>
            <span style={{ color: 'var(--ba-glow-amber)', fontSize: 12 }}>{m.weekly_contribution.toLocaleString()}</span>
          </div>
        ))}
        {guildMembers.length === 0 && <div style={{ color: 'var(--ba-marble-800)', fontSize: 12 }}>No member data yet.</div>}
        {!myGuild && (
          <button onClick={() => handleJoin(selectedGuild)} disabled={busy} style={guildActionBtnStyle}>
            {busy ? '...' : 'Join Guild'}
          </button>
        )}
        {myGuild && (
          <button onClick={handleLeave} disabled={busy} style={{ ...guildActionBtnStyle, background: 'rgba(239,68,68,0.2)', border: '1px solid var(--ba-danger)' }}>
            {busy ? '...' : 'Leave Guild'}
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
          <span style={{ color: 'var(--ba-accent)', fontWeight: 700 }}>Top Guilds</span>
        </div>
        {topGuilds.map((g, i) => (
          <div key={g.id} onClick={() => openDetail(g)} className="ba-glass" style={{
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid var(--ba-card-border)',
            borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
          }}>
            <div style={{ color: 'var(--ba-accent)', fontWeight: 700, width: 24 }}>#{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ba-marble-200)' }}>[{g.tag}] {g.name}</div>
              <div style={{ color: 'var(--ba-marble-500)', fontSize: 12 }}>{g.member_count} members</div>
            </div>
            <div style={{ color: 'var(--ba-accent)', fontSize: 13 }}>{g.weekly_score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    );
  }

  // Main guild view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {myGuildId ? (
        <div className="ba-glass" style={{
          border: '1px solid var(--ba-accent)',
          borderRadius: 12, padding: 16,
          boxShadow: '0 0 12px var(--ba-accent-glow)',
        }}>
          <div style={{ color: 'var(--ba-accent)', fontWeight: 700, marginBottom: 6 }}>Your Guild</div>
          <div style={{ color: 'var(--ba-marble-500)', fontSize: 12, marginBottom: 10 }}>
            Guild ID: {myGuildId.slice(0, 8)}...
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setSelectedGuild(topGuilds.find(g => g.id === myGuildId) ?? null); setView('detail'); }} style={guildBackBtnStyle}>
              View Details
            </button>
            <button onClick={handleLeave} disabled={busy} style={{ ...guildActionBtnStyle, background: 'rgba(239,68,68,0.2)', border: '1px solid var(--ba-danger)' }}>
              {busy ? '...' : 'Leave'}
            </button>
          </div>
        </div>
      ) : (
        <div className="ba-glass" style={{
          border: '1px solid var(--ba-card-border)',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ba-accent)', marginBottom: 4 }}>Not in a guild</div>
          <div style={{ color: 'var(--ba-marble-500)', fontSize: 13, marginBottom: 20 }}>
            Join a guild to earn bonus SC and compete in weekly events.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setView('create')} style={guildActionBtnStyle}>Create Guild</button>
            <button onClick={() => setView('browse')} style={guildBackBtnStyle}>Browse Guilds</button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--ba-card-bg)', border: '1px solid var(--ba-card-border)',
  color: 'var(--ba-marble-200)', borderRadius: 8, padding: '10px 14px',
  fontSize: 13, fontFamily: 'monospace', outline: 'none',
};

const guildActionBtnStyle: React.CSSProperties = {
  background: 'var(--ba-accent)', border: 'none', color: '#fff',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
  boxShadow: '0 0 8px var(--ba-accent-glow)',
};

const guildBackBtnStyle: React.CSSProperties = {
  background: 'var(--ba-card-bg)', border: '1px solid var(--ba-card-border)', color: 'var(--ba-marble-200)',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
};

const backBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--ba-card-border)', color: 'var(--ba-accent)',
  borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 16,
};
