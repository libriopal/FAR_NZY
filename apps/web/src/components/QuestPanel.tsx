// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { QuestTheme } from '@match3d/ai-quests';
import { useQuests } from '../hooks/useQuests.js';
import { OV, TYPE } from '../theme/tokens.js';

export function QuestPanel() {
  const { quests, loading, acceptQuest } = useQuests();
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div style={{
        color: OV.boneDim, fontSize: 12, fontFamily: TYPE.fontCode,
        textAlign: 'center', padding: '16px 0',
      }}>
        Loading quests...
      </div>
    );
  }

  if (quests.length === 0) {
    return (
      <div style={{
        color: OV.boneDim, fontSize: 11, fontFamily: TYPE.fontCode,
        textAlign: 'center', padding: '20px 0',
        borderTop: `1px solid ${OV.goldDim}`,
        marginTop: 8,
      }}>
        No active quests — check back soon.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <div style={{
        color: OV.gold, fontSize: 11, fontFamily: TYPE.fontCode,
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10,
        textShadow: `0 0 6px ${OV.goldGlow}`,
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
      background: `rgba(13,0,24,0.88)`,
      border: `1px solid ${isAccepted ? OV.goldDim : OV.cyanGlow}`,
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              color: OV.bone, fontWeight: 700, fontSize: 13,
              fontFamily: TYPE.fontBody,
            }}>
              {quest.name}
            </span>
            {quest.generatedBy === 'llm' && (
              <span style={{
                fontSize: 9, background: OV.neural,
                color: OV.cyanBright, borderRadius: 4, padding: '1px 5px',
                fontFamily: TYPE.fontCode, border: `1px solid ${OV.cyanGlow}`,
              }}>AI</span>
            )}
            <span style={{ color: OV.boneDim, fontSize: 9, marginLeft: 'auto', fontFamily: TYPE.fontCode }}>
              {timeLeft > 0 ? `${timeLeft}h left` : 'Expiring soon'}
            </span>
          </div>
          <div style={{
            color: OV.bone, opacity: 0.7, fontSize: 11,
            fontFamily: TYPE.fontBody, lineHeight: 1.4, marginBottom: 6,
          }}>
            {quest.flavorText}
          </div>
          {quest.objectives.map(obj => (
            <div key={obj.id} style={{ color: OV.cyanBright, fontSize: 11, fontFamily: TYPE.fontCode }}>
              ▸ {obj.label}
            </div>
          ))}
          <div style={{
            color: OV.goldBright, fontSize: 10,
            fontFamily: TYPE.fontCode, marginTop: 4,
            textShadow: `0 0 4px ${OV.goldGlow}`,
          }}>
            ×{quest.rewardMultiplier.toFixed(1)} reward
          </div>
        </div>
        <button
          onClick={onAccept}
          disabled={isAccepted}
          style={{
            background: isAccepted ? 'transparent' : OV.cyan,
            border: isAccepted ? `1px solid ${OV.goldDim}` : 'none',
            color: isAccepted ? OV.gold : OV.void,
            borderRadius: 6, padding: '8px 12px',
            fontSize: 11, cursor: isAccepted ? 'default' : 'pointer',
            fontFamily: TYPE.fontCode, fontWeight: 700, whiteSpace: 'nowrap',
            boxShadow: isAccepted ? 'none' : `0 0 8px ${OV.cyan}60`,
          }}
        >
          {isAccepted ? '✓ Active' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
