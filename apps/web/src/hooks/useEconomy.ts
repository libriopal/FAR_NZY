// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────

import { useCallback, useRef } from 'react';
import { EconomyClient } from '@match3d/economy';
import type { TransactionRequest, TransactionRecord, BattlePassTier } from '@match3d/economy';
import { useGameStore } from '../store/gameStore.js';
import { processTransaction } from '@match3d/backend-client';
import { blockchainQueue } from '@match3d/blockchain';
import { v4 as uuidv4 } from 'uuid';

// Singleton economy client shared across the app lifetime
const _economyClient = new EconomyClient();

let _serverSyncWired = false;

function wireServerSync() {
  if (_serverSyncWired) return;
  _serverSyncWired = true;

  _economyClient.setServerSyncHandler(async (req: TransactionRequest): Promise<TransactionRecord> => {
    try {
      const result = await processTransaction({
        id: req.id,
        type: req.type,
        currency: req.currency,
        amount: req.amount,
        metadata: req.metadata,
      });

      const record: TransactionRecord = {
        id: req.id,
        userId: req.userId,
        type: req.type,
        currency: req.currency,
        amount: req.amount,
        balanceBefore: result?.balance_before ?? 0,
        balanceAfter: result?.balance_after ?? 0,
        timestamp: Date.now(),
        serverValidated: true,
        blockchainTxHash: result?.blockchain_tx_hash ?? null,
      };

      blockchainQueue.enqueue({
        userId: req.userId,
        entryType: 'economy_tx',
        payloadHash: result?.payload_hash ?? '',
        timestamp: Date.now(),
      });

      return record;
    } catch {
      // Fallback: optimistic local record (no server validation)
      return {
        id: req.id,
        userId: req.userId,
        type: req.type,
        currency: req.currency,
        amount: req.amount,
        balanceBefore: 0,
        balanceAfter: req.amount,
        timestamp: Date.now(),
        serverValidated: false,
        blockchainTxHash: null,
      };
    }
  });
}

export function useEconomy() {
  const userId = useGameStore(s => s.userId);
  const economyBalance = useGameStore(s => s.economyBalance);
  const updateEconomyBalance = useGameStore(s => s.updateEconomyBalance);

  wireServerSync();

  const creditReward = useCallback(async (
    type: TransactionRequest['type'],
    currency: 'goldCoins' | 'sweepsCoins',
    amount: number,
    metadata: Record<string, unknown> = {},
  ) => {
    const req: TransactionRequest = {
      id: uuidv4(),
      userId: userId ?? 'anon',
      type,
      currency,
      amount,
      metadata,
    };

    const record = await _economyClient.credit(req);

    if (record?.serverValidated) {
      updateEconomyBalance({
        ...economyBalance,
        [currency]: record.balanceAfter,
        lastUpdated: record.timestamp,
      });
    } else {
      // Optimistic update
      updateEconomyBalance({
        ...economyBalance,
        [currency]: economyBalance[currency] + amount,
        lastUpdated: Date.now(),
      });
    }

    return record;
  }, [userId, economyBalance, updateEconomyBalance]);

  const syncBalance = useCallback((goldCoins: number, sweepsCoins: number) => {
    _economyClient.applyServerBalance({ goldCoins, sweepsCoins, lastUpdated: Date.now() });
    updateEconomyBalance({ goldCoins, sweepsCoins, lastUpdated: Date.now() });
  }, [updateEconomyBalance]);

  const claimBattlePassTier = useCallback(async (tierDef: BattlePassTier): Promise<boolean> => {
    if (economyBalance.goldCoins < tierDef.goldCost) return false;
    // Optimistic update: deduct cost, credit gold+SC rewards
    updateEconomyBalance({
      ...economyBalance,
      goldCoins: economyBalance.goldCoins - tierDef.goldCost + tierDef.goldReward,
      sweepsCoins: economyBalance.sweepsCoins + tierDef.scReward,
      lastUpdated: Date.now(),
    });
    // Log via creditReward for blockchain queue (net gold, SC separately if applicable)
    await creditReward('battle_pass_reward', 'goldCoins', tierDef.goldReward - tierDef.goldCost, { tier: tierDef.tier });
    if (tierDef.scReward > 0) {
      await creditReward('battle_pass_reward', 'sweepsCoins', tierDef.scReward, { tier: tierDef.tier });
    }
    return true;
  }, [userId, economyBalance, updateEconomyBalance, creditReward]);

  return { creditReward, syncBalance, claimBattlePassTier, economyClient: _economyClient };
}
