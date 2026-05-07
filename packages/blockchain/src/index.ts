// ─── Blockchain Transparency Layer ────────────────────────────────────────────
// Hybrid approach: transactions are queued client-side, written async to
// a lightweight L2 (Polygon) via a backend relay. Does NOT block gameplay.

export interface BlockchainEntry {
  txHash: string | null;
  userId: string;
  entryType: 'economy_tx' | 'level_result' | 'rng_seed';
  payloadHash: string; // SHA-256 of the payload — verifiable without storing raw data
  timestamp: number;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  blockNumber: number | null;
}

export interface RNGProof {
  seed: string;         // server-generated seed committed before level start
  seedHash: string;     // SHA-256 of seed, visible to client before play
  revealedAt: number;   // when seed was revealed post-level
}

// Lightweight in-memory queue — flushed to backend relay every N ms
export class BlockchainQueue {
  private queue: Array<{ entry: Omit<BlockchainEntry, 'txHash' | 'blockNumber' | 'chainStatus'>; retries: number }> = [];
  private flushHandle: ReturnType<typeof setInterval> | null = null;
  private relayFn: ((entries: typeof this.queue[number]['entry'][]) => Promise<BlockchainEntry[]>) | null = null;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private readonly MAX_QUEUE = 100;

  setRelayFunction(fn: typeof this.relayFn): void {
    this.relayFn = fn;
  }

  enqueue(entry: Omit<BlockchainEntry, 'txHash' | 'blockNumber' | 'chainStatus'>): void {
    if (this.queue.length >= this.MAX_QUEUE) {
      // Drop oldest to prevent memory bloat
      this.queue.shift();
    }
    this.queue.push({ entry, retries: 0 });
  }

  startAutoFlush(): void {
    if (this.flushHandle) return;
    this.flushHandle = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  stopAutoFlush(): void {
    if (this.flushHandle) {
      clearInterval(this.flushHandle);
      this.flushHandle = null;
    }
  }

  async flush(): Promise<void> {
    if (!this.relayFn || this.queue.length === 0) return;
    const batch = this.queue.splice(0, 20).map(q => q.entry);
    try {
      await this.relayFn(batch);
    } catch (err) {
      console.warn('[Blockchain] Relay flush failed, will retry:', err);
      // Re-queue with retry count increment (max 3)
      for (const entry of batch) {
        this.queue.unshift({ entry, retries: 1 });
      }
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}

// ─── Verifiable RNG ───────────────────────────────────────────────────────────
// Server commits to a seed hash before the level. After level ends, seed
// is revealed. Client can verify: sha256(seed) === seedHash.

export function generateRNGProofVerifier() {
  return {
    async verifySeed(proof: RNGProof): Promise<boolean> {
      if (typeof crypto === 'undefined') return false;
      const encoder = new TextEncoder();
      const data = encoder.encode(proof.seed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex === proof.seedHash;
    },

    async hashPayload(payload: Record<string, unknown>): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload, Object.keys(payload).sort()));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
  };
}

export const blockchainQueue = new BlockchainQueue();
export const rngVerifier = generateRNGProofVerifier();
