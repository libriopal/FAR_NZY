// ─── Generic Object Pool for Performance ─────────────────────────────────────

export interface PoolStats {
  poolSize: number;
  activeCount: number;
  acquireCount: number;
  releaseCount: number;
  growCount: number;
}

export class ObjectPool<T> {
  private pool: T[] = [];
  private activeCount = 0;
  private stats: PoolStats = {
    poolSize: 0,
    activeCount: 0,
    acquireCount: 0,
    releaseCount: 0,
    growCount: 0,
  };

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    initialSize: number
  ) {
    this.preAllocate(initialSize);
  }

  preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
    this.stats.poolSize = this.pool.length + this.activeCount;
  }

  acquire(): T {
    this.stats.acquireCount++;
    this.activeCount++;
    this.stats.activeCount = this.activeCount;

    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Pool exhausted — grow by 10
    this.stats.growCount++;
    console.warn(`[ObjectPool] Pool exhausted, growing by 10 (active: ${this.activeCount})`);
    this.preAllocate(10);
    this.stats.poolSize = this.pool.length + this.activeCount;
    return this.pool.pop()!;
  }

  release(item: T): void {
    this.reset(item);
    this.pool.push(item);
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.stats.activeCount = this.activeCount;
    this.stats.releaseCount++;
    this.stats.poolSize = this.pool.length + this.activeCount;
  }

  getStats(): Readonly<PoolStats> {
    return { ...this.stats };
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getPooledCount(): number {
    return this.pool.length;
  }

  drain(): void {
    this.pool.length = 0;
    this.activeCount = 0;
    this.stats = { poolSize: 0, activeCount: 0, acquireCount: 0, releaseCount: 0, growCount: 0 };
  }
}
