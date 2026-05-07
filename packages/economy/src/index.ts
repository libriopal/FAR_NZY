// ─── Server-Authoritative Economy Manager ────────────────────────────────────
// All mutations must be validated server-side before applying client-side display.

export type CurrencyType = 'goldCoins' | 'sweepsCoins';

export interface EconomyBalance {
  goldCoins: number;
  sweepsCoins: number;
  lastUpdated: number;
}

export interface TransactionRequest {
  id: string; // client-generated idempotency key (uuid)
  userId: string;
  type: TransactionType;
  currency: CurrencyType;
  amount: number; // always positive; direction determined by type
  metadata: Record<string, unknown>;
}

export type TransactionType =
  | 'purchase'       // real money -> gold coins (IAP)
  | 'reward_ad'      // rewarded ad completion
  | 'level_complete' // gameplay reward
  | 'daily_bonus'
  | 'gift_received'
  | 'booster_spend'
  | 'sweeps_award'   // promotional SC grant
  | 'refund';

export interface TransactionRecord {
  id: string;
  userId: string;
  type: TransactionType;
  currency: CurrencyType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: number;
  serverValidated: boolean;
  blockchainTxHash: string | null;
}

// Client-side optimistic economy state — always reconciled with server
export class EconomyClient {
  private balance: EconomyBalance = { goldCoins: 0, sweepsCoins: 0, lastUpdated: 0 };
  private pendingTransactions = new Map<string, TransactionRequest>();
  private onSyncCallback: ((req: TransactionRequest) => Promise<TransactionRecord>) | null = null;

  setServerSyncHandler(fn: (req: TransactionRequest) => Promise<TransactionRecord>): void {
    this.onSyncCallback = fn;
  }

  applyServerBalance(balance: EconomyBalance): void {
    this.balance = { ...balance };
  }

  getBalance(): Readonly<EconomyBalance> {
    return { ...this.balance };
  }

  canAfford(currency: CurrencyType, amount: number): boolean {
    return this.balance[currency] >= amount;
  }

  // Optimistic spend — server must confirm
  async spend(req: Omit<TransactionRequest, 'type'> & { type: Extract<TransactionType, 'booster_spend'> }): Promise<TransactionRecord | null> {
    if (!this.canAfford(req.currency, req.amount)) return null;
    return this._submitTransaction({ ...req });
  }

  async credit(req: TransactionRequest): Promise<TransactionRecord | null> {
    return this._submitTransaction(req);
  }

  private async _submitTransaction(req: TransactionRequest): Promise<TransactionRecord | null> {
    if (!this.onSyncCallback) {
      console.error('[Economy] No server sync handler registered');
      return null;
    }

    this.pendingTransactions.set(req.id, req);

    try {
      const record = await this.onSyncCallback(req);
      if (record.serverValidated) {
        this.balance[req.currency] = record.balanceAfter;
        this.balance.lastUpdated = record.timestamp;
      }
      this.pendingTransactions.delete(req.id);
      return record;
    } catch (err) {
      console.error('[Economy] Transaction sync failed:', err);
      this.pendingTransactions.delete(req.id);
      return null;
    }
  }

  getPendingCount(): number {
    return this.pendingTransactions.size;
  }
}

// ─── Pricing Config (for IAP + ad rewards) ───────────────────────────────────

export interface PricingTier {
  id: string;
  goldCoins: number;
  usdCents: number; // 0 for free/earned
  sweepsCoinsBonus: number;
  label: string;
}

export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  { id: 'starter', goldCoins: 1000, usdCents: 99, sweepsCoinsBonus: 0, label: 'Starter Pack' },
  { id: 'value', goldCoins: 5500, usdCents: 499, sweepsCoinsBonus: 100, label: 'Value Pack' },
  { id: 'popular', goldCoins: 12000, usdCents: 999, sweepsCoinsBonus: 300, label: 'Popular Pack' },
  { id: 'mega', goldCoins: 55000, usdCents: 3999, sweepsCoinsBonus: 1500, label: 'Mega Pack' },
];

export const AD_REWARD_AMOUNTS: Record<string, { goldCoins: number; sweepsCoins: number }> = {
  revive: { goldCoins: 500, sweepsCoins: 0 },
  booster: { goldCoins: 300, sweepsCoins: 0 },
  daily_free: { goldCoins: 200, sweepsCoins: 5 },
};
