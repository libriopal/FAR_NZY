import React, { useState } from 'react';
import type { QuestTheme } from '@match3d/ai-quests';
import { useQuests } from '../hooks/useQuests.js';

export function QuestPanel() {
  const { quests, loading, acceptQuest } = useQuests();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div style={{ color: '#1a4060', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
        Loading quests...
      </div>
    );
  }

  if (quests.length === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <div style={{
        color: '#2a6a4a', fontSize: 11, textTransform: 'uppercase',
        letterSpacing: 1, marginBottom: 10,
      }}>
        Active Quests
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quests.slice(0, 3).map(q => (
          <QuestCard
            key={q.id}
            quest={q}
            isAccepted={accepted.has(q.id)}
            onAccept={() => {
              setAccepted(prev => new Set([...prev, q.id]));
              acceptQuest(q);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function QuestCard({ quest, isAccepted, onAccept }: {
  quest: QuestTheme;
  isAccepted: boolean;
  onAccept: () => void;
}) {
  const timeLeft = Math.max(0, Math.floor((quest.expiresAt - Date.now()) / 3_600_000));

  return (
    <div style={{
      background: 'rgba(13,42,20,0.7)', border: '1px solid #1a3a2a',
      borderRadius: 10, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ color: '#5de58a', fontWeight: 700, fontSize: 13 }}>{quest.name}</span>
            {quest.generatedBy === 'llm' && (
              <span style={{
                fontSize: 9, background: '#0a2a18', color: '#2a7a4a',
                borderRadius: 4, padding: '1px 5px',
              }}>AI</span>
            )}
            <span style={{ color: '#1a4a2a', fontSize: 9, marginLeft: 'auto' }}>
              {timeLeft > 0 ? `${timeLeft}h left` : 'Expiring soon'}
            </span>
          </div>
          <div style={{ color: '#2a6a3a', fontSize: 11, lineHeight: 1.4, marginBottom: 6 }}>
            {quest.flavorText}
          </div>
          {quest.objectives.map(obj => (
            <div key={obj.id} style={{ color: '#1a4a2a', fontSize: 11 }}>
              • {obj.label}
            </div>
          ))}
          <div style={{ color: '#ffd700', fontSize: 10, marginTop: 4 }}>
            ×{quest.rewardMultiplier.toFixed(1)} reward multiplier
          </div>
        </div>
        <button
          onClick={onAccept}
          disabled={isAccepted}
          style={{
            background: isAccepted ? 'transparent' : '#1a6fd4',
            border: isAccepted ? '1px solid #1a4a2a' : 'none',
            color: isAccepted ? '#2a4a2a' : '#fff',
            borderRadius: 8, padding: '8px 12px',
            fontSize: 11, cursor: isAccepted ? 'default' : 'pointer',
            fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap',
          }}
        >
          {isAccepted ? '✓ Active' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
