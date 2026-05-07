import { useState, useEffect, useCallback } from 'react';
import { questManager } from '@match3d/ai-quests';
import type { QuestTheme } from '@match3d/ai-quests';
import { fetchQuestsForUser } from '@match3d/backend-client';
import { useGameStore } from '../store/gameStore.js';
import { analytics } from '@match3d/analytics';

let _questsWired = false;

export function useQuests() {
  const userId = useGameStore(s => s.userId);
  const [quests, setQuests] = useState<QuestTheme[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (_questsWired) return;
    _questsWired = true;
    questManager.setFetchFunction(fetchQuestsForUser);
  }, []);

  const loadQuests = useCallback(async () => {
    if (!userId) {
      setQuests(questManager.getActiveQuests().length > 0
        ? questManager.getActiveQuests()
        : await questManager.loadQuestsForUser('guest'));
      return;
    }
    setLoading(true);
    try {
      const loaded = await questManager.loadQuestsForUser(userId);
      setQuests(loaded);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadQuests();
  }, [loadQuests]);

  const acceptQuest = useCallback((quest: QuestTheme) => {
    analytics.track({ name: 'quest_accepted', props: { questId: quest.id, generatedBy: quest.generatedBy } });
  }, []);

  return { quests, loading, reload: loadQuests, acceptQuest };
}
