import type { MatchResult, GameItem, ItemDefinition } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';
import type { TraySystem } from './TraySystem.js';
import type { ItemSystem } from './ItemSystem.js';

export class MatchSystem {
  private comboCount = 0;
  private lastMatchTime = 0;
  private readonly COMBO_WINDOW_MS = 3000;

  constructor(
    private readonly bus: GameEventBus,
    private readonly tray: TraySystem,
    private readonly items: ItemSystem
  ) {}

  checkAndResolveMatches(): MatchResult[] {
    const triples = this.tray.detectTriples();
    const results: MatchResult[] = [];

    for (const triple of triples) {
      const result = this._resolveTriple(triple.definitionId, triple.slots);
      if (result) results.push(result);
    }

    return results;
  }

  private _resolveTriple(
    definitionId: string,
    slotIndices: [number, number, number]
  ): MatchResult | null {
    const itemIds: string[] = [];
    for (const idx of slotIndices) {
      const item = this.tray.getItemAtSlot(idx);
      if (!item) return null;
      itemIds.push(item.id);
    }

    if (itemIds.length !== 3) return null;

    const def = this.items.getDefinition(definitionId);
    if (!def) return null;

    const now = Date.now();
    const isCombo = now - this.lastMatchTime < this.COMBO_WINDOW_MS;
    this.comboCount = isCombo ? this.comboCount + 1 : 1;
    this.lastMatchTime = now;
    const multiplier = Math.min(1 + (this.comboCount - 1) * 0.25, 3.0);

    const scoreValue = Math.round(def.matchValue * multiplier * 100);
    const resourceReward = this._scaleRewards(def.resourceRewards, multiplier);

    const result: MatchResult = {
      definitionId,
      itemIds: [itemIds[0]!, itemIds[1]!, itemIds[2]!],
      slotIndices,
      scoreValue,
      resourceReward,
      timestamp: now,
    };

    // Remove items from tray
    this.tray.removeItems(slotIndices);

    // Remove from item system
    for (const id of itemIds) {
      this.items.removeItem(id, 'match');
    }

    this.bus.emit('tray:match-detected', result);
    this.bus.emit('match:resolved', result);

    if (this.comboCount > 1) {
      this.bus.emit('match:combo', { count: this.comboCount, multiplier });
    }

    return result;
  }

  private _scaleRewards(
    base: Partial<Record<'bioSteel' | 'aeroSeeds', number>>,
    multiplier: number
  ): Partial<Record<'bioSteel' | 'aeroSeeds', number>> {
    const scaled: Partial<Record<'bioSteel' | 'aeroSeeds', number>> = {};
    for (const [k, v] of Object.entries(base) as Array<['bioSteel' | 'aeroSeeds', number]>) {
      scaled[k] = Math.round(v * multiplier);
    }
    return scaled;
  }

  resetCombo(): void {
    this.comboCount = 0;
    this.lastMatchTime = 0;
  }

  getComboCount(): number {
    return this.comboCount;
  }
}
