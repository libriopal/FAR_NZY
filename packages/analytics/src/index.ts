// ─── LiveOps Analytics System ────────────────────────────────────────────────
// Event tracking + cohort/A-B testing hooks.
// Sends to backend via batched flush — never blocks gameplay.

export type AnalyticsEvent =
  | { name: 'session_start'; props: { userId: string; platform: string; appVersion: string } }
  | { name: 'level_start'; props: { levelId: string; attemptNumber: number } }
  | { name: 'level_complete'; props: { levelId: string; score: number; timeRemaining: number; objectivesCompleted: number } }
  | { name: 'level_fail'; props: { levelId: string; reason: 'overflow' | 'timeout'; score: number } }
  | { name: 'item_selected'; props: { definitionId: string; category: string } }
  | { name: 'match_resolved'; props: { definitionId: string; scoreValue: number; comboCount: number } }
  | { name: 'tray_overflow'; props: { levelId: string; filledSlots: number } }
  | { name: 'booster_used'; props: { boosterType: string; currency: string; cost: number } }
  | { name: 'ad_shown'; props: { adType: 'rewarded' | 'interstitial'; rewardType?: string } }
  | { name: 'ad_reward_claimed'; props: { rewardType: string; goldCoins: number; sweepsCoins: number } }
  | { name: 'purchase'; props: { tierId: string; usdCents: number; goldCoins: number } }
  | { name: 'upgrade_purchased'; props: { upgradeId: string; tier: number } }
  | { name: 'quest_accepted'; props: { questId: string; generatedBy: 'llm' | 'template' } }
  | { name: 'quest_completed'; props: { questId: string; timeToCompleteMs: number } }
  | { name: 'compliance_denied'; props: { reason: 'age' | 'state' | 'terms'; state?: string } }
  | { name: 'ab_assignment'; props: { experimentId: string; variant: string } };

export interface BatchedEvent {
  name: string;
  props: Record<string, unknown>;
  userId: string;
  sessionId: string;
  timestamp: number;
  platform: string;
  appVersion: string;
  cohortId: string | null;
  abGroup: string | null;
  firstSessionDate: string | null;
  daysSinceInstall: number | null;
}

// ─── A/B Testing ──────────────────────────────────────────────────────────────

export interface ABExperiment {
  id: string;
  variants: Array<{ id: string; weight: number }>;
}

export class ABTestingService {
  private assignments = new Map<string, string>();
  private experiments = new Map<string, ABExperiment>();

  registerExperiment(exp: ABExperiment): void {
    this.experiments.set(exp.id, exp);
  }

  getVariant(experimentId: string, userId: string): string {
    const key = `${experimentId}:${userId}`;
    if (this.assignments.has(key)) return this.assignments.get(key)!;

    const exp = this.experiments.get(experimentId);
    if (!exp) return 'control';

    const variant = this._assignVariant(exp, userId);
    this.assignments.set(key, variant);
    return variant;
  }

  private _assignVariant(exp: ABExperiment, userId: string): string {
    // Deterministic based on userId hash — same user always gets same variant
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    const normalized = (Math.abs(hash) % 1000) / 1000;

    let cumulative = 0;
    const total = exp.variants.reduce((s, v) => s + v.weight, 0);
    for (const variant of exp.variants) {
      cumulative += variant.weight / total;
      if (normalized < cumulative) return variant.id;
    }
    return exp.variants[exp.variants.length - 1]!.id;
  }

  serialize(): Record<string, string> {
    return Object.fromEntries(this.assignments);
  }

  deserialize(data: Record<string, string>): void {
    for (const [k, v] of Object.entries(data)) {
      this.assignments.set(k, v);
    }
  }
}

// ─── Analytics Client ─────────────────────────────────────────────────────────

export class AnalyticsClient {
  private queue: BatchedEvent[] = [];
  private flushHandle: ReturnType<typeof setInterval> | null = null;
  private userId = '';
  private sessionId = '';
  private platform = 'web';
  private appVersion = '1.0.0';
  private cohortId: string | null = null;
  private abGroup: string | null = null;
  private firstSessionDate: string | null = null;
  private flushFn: ((events: BatchedEvent[]) => Promise<void>) | null = null;
  private readonly FLUSH_INTERVAL_MS = 10_000;
  private readonly MAX_QUEUE = 500;

  readonly ab = new ABTestingService();

  configure(config: {
    userId: string;
    sessionId: string;
    platform: string;
    appVersion: string;
    cohortId?: string;
    flushFn: (events: BatchedEvent[]) => Promise<void>;
  }): void {
    this.userId = config.userId;
    this.sessionId = config.sessionId;
    this.platform = config.platform;
    this.appVersion = config.appVersion;
    this.cohortId = config.cohortId ?? null;
    this.flushFn = config.flushFn;

    // Cohort: persist first session date
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('analytics_fsd') : null;
    if (!stored) {
      this.firstSessionDate = new Date().toISOString().slice(0, 10);
      if (typeof localStorage !== 'undefined') localStorage.setItem('analytics_fsd', this.firstSessionDate);
    } else {
      this.firstSessionDate = stored;
    }

    // AB group: deterministic bucket from userId
    let hash = 0;
    for (let i = 0; i < config.userId.length; i++) hash = ((hash << 5) - hash + config.userId.charCodeAt(i)) | 0;
    const bucket = Math.abs(hash) % 3;
    this.abGroup = ['A', 'B', 'C'][bucket] ?? 'A';
  }

  getAbGroup(): string | null {
    return this.abGroup;
  }

  setAbGroup(group: string): void {
    this.abGroup = group;
  }

  track(event: AnalyticsEvent): void {
    if (this.queue.length >= this.MAX_QUEUE) this.queue.shift();
    const daysSinceInstall = this.firstSessionDate
      ? Math.floor((Date.now() - new Date(this.firstSessionDate).getTime()) / 86_400_000)
      : null;
    this.queue.push({
      name: event.name,
      props: event.props as Record<string, unknown>,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      platform: this.platform,
      appVersion: this.appVersion,
      cohortId: this.cohortId,
      abGroup: this.abGroup,
      firstSessionDate: this.firstSessionDate,
      daysSinceInstall,
    });
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
    if (!this.flushFn || this.queue.length === 0) return;
    const batch = this.queue.splice(0, 50);
    try {
      await this.flushFn(batch);
    } catch {
      // Re-queue on failure (non-blocking)
      this.queue.unshift(...batch.slice(0, 20));
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}

export const analytics = new AnalyticsClient();

// ─── Predefined Experiments ───────────────────────────────────────────────────

analytics.ab.registerExperiment({
  id: 'tray_size',
  variants: [
    { id: 'control_7', weight: 0.5 },
    { id: 'test_9', weight: 0.5 },
  ],
});

analytics.ab.registerExperiment({
  id: 'interstitial_frequency',
  variants: [
    { id: 'every_3', weight: 0.33 },
    { id: 'every_5', weight: 0.34 },
    { id: 'every_7', weight: 0.33 },
  ],
});
