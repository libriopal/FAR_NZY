import EventEmitter from 'eventemitter3';
import type {
  GameItem,
  LevelConfig,
  MatchResult,
  ObjectiveState,
  ItemModifier,
  ResourceType,
  EstateUpgrade,
  TraySlot,
} from '../types/index.js';

// ─── Typed Event Map ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GameEvents extends Record<string, any[]> {
  'item:spawned': [item: GameItem];
  'item:selected': [item: GameItem];
  'item:placed-in-tray': [data: { item: GameItem; slotIndex: number }];
  'item:removed': [data: { itemId: string; reason: 'match' | 'booster' }];
  'tray:match-detected': [result: MatchResult];
  'tray:overflow': [data: { item: GameItem }];
  'tray:updated': [slots: TraySlot[]];
  'match:resolved': [result: MatchResult];
  'match:combo': [data: { count: number; multiplier: number }];
  'objective:progress': [data: { objectiveId: string; current: number; total: number }];
  'objective:completed': [state: ObjectiveState];
  'level:started': [config: LevelConfig];
  'level:won': [data: { score: number; timeRemaining: number; objectivesCompleted: number }];
  'level:lost': [data: { reason: 'overflow' | 'timeout' }];
  'level:paused': [];
  'level:resumed': [];
  'modifier:activated': [data: { itemId: string; modifier: ItemModifier }];
  'modifier:expired': [data: { itemId: string; modifierType: string }];
  'modifier:overgrowth-spread': [data: { sourceItemId: string; affectedItemIds: string[] }];
  'meta:resource-gained': [data: { type: ResourceType; amount: number; newTotal: number }];
  'meta:resource-spent': [data: { type: ResourceType; amount: number; newTotal: number }];
  'meta:upgrade-purchased': [upgrade: EstateUpgrade];
  'physics:step-complete': [data: { timestamp: number; bodyCount: number }];
  'booster:used': [data: { type: string; playerId?: string }];
  'session:saved': [data: { timestamp: number }];
}

// ─── Typed EventBus ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventBus<TEvents extends Record<string, any[]>> {
  private emitter = new EventEmitter();

  on<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  once<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: (...args: TEvents[K]) => void
  ): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof TEvents & string>(event: K, ...args: TEvents[K]): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(event?: keyof TEvents & string): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  listenerCount(event: keyof TEvents & string): number {
    return this.emitter.listenerCount(event);
  }
}

export type GameEventBus = TypedEventBus<GameEvents>;

export function createGameEventBus(): GameEventBus {
  return new TypedEventBus<GameEvents>();
}
