import { createHash } from 'crypto';
import { AI_CONFIG } from '../config.js';

interface CacheEntry {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  expiresAt: number;
}

// In-memory cache for Phase 1. Interface supports future Redis/persistent backend
// by replacing the Map with a RedisCache that implements the same get/set/delete contract.
export class ResponseCache {
  private readonly store = new Map<string, CacheEntry>();

  key(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  get(cacheKey: string): CacheEntry | null {
    const entry = this.store.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(cacheKey);
      return null;
    }
    return entry;
  }

  set(cacheKey: string, entry: Omit<CacheEntry, 'expiresAt'>): void {
    this.store.set(cacheKey, {
      ...entry,
      expiresAt: Date.now() + AI_CONFIG.cacheTtlMs,
    });
  }

  delete(cacheKey: string): void {
    this.store.delete(cacheKey);
  }

  size(): number {
    return this.store.size;
  }
}

export const responseCache = new ResponseCache();
