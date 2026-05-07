import type { GameItem, ItemModifier } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';
import type { ItemSystem } from './ItemSystem.js';
import type { PhysicsPileSystem } from './PhysicsPileSystem.js';

export class ModifierSystem {
  constructor(
    private readonly bus: GameEventBus,
    private readonly itemSystem: ItemSystem,
    private readonly physics: PhysicsPileSystem
  ) {}

  onMatchResolved(): void {
    const pileItems = this.itemSystem.getItemsInPile();
    for (const item of pileItems) {
      this._tickModifiers(item);
    }
    this._processOvergrowthSpreads(pileItems);
  }

  private _tickModifiers(item: GameItem): void {
    for (const mod of item.modifiers) {
      switch (mod.type) {
        case 'frozen': {
          mod.turnsRemaining -= 1;
          if (mod.turnsRemaining <= 0) {
            this.itemSystem.removeModifier(item.id, 'frozen');
            this.physics.unfreezeBody(item.id);
          }
          break;
        }
        case 'locked': {
          mod.scaffoldCount -= 1;
          if (mod.scaffoldCount <= 0) {
            this.itemSystem.removeModifier(item.id, 'locked');
          }
          break;
        }
        case 'overgrowth': {
          mod.turnsToSpread -= 1;
          break;
        }
      }
    }
  }

  private _processOvergrowthSpreads(pileItems: GameItem[]): void {
    const spreaders = pileItems.filter(i =>
      i.modifiers.some(m => m.type === 'overgrowth' && (m as Extract<ItemModifier, {type:'overgrowth'}>).turnsToSpread <= 0)
    );

    for (const spreader of spreaders) {
      const ovGrowth = spreader.modifiers.find(
        m => m.type === 'overgrowth'
      ) as Extract<ItemModifier, { type: 'overgrowth' }> | undefined;
      if (!ovGrowth) continue;

      const nearby = this._findNearby(spreader, pileItems, ovGrowth.spreadRadius);
      const affected: string[] = [];

      for (const target of nearby) {
        const alreadyHas = target.modifiers.some(m => m.type === 'overgrowth');
        if (!alreadyHas) {
          this.itemSystem.addModifier(target.id, {
            type: 'overgrowth',
            spreadRadius: ovGrowth.spreadRadius,
            turnsToSpread: 3,
          });
          affected.push(target.id);
        }
      }

      // Reset spread timer
      ovGrowth.turnsToSpread = 4;

      if (affected.length > 0) {
        this.bus.emit('modifier:overgrowth-spread', {
          sourceItemId: spreader.id,
          affectedItemIds: affected,
        });
      }
    }
  }

  private _findNearby(source: GameItem, items: GameItem[], radius: number): GameItem[] {
    const result: GameItem[] = [];
    for (const item of items) {
      if (item.id === source.id) continue;
      const dx = item.position.x - source.position.x;
      const dy = item.position.y - source.position.y;
      const dz = item.position.z - source.position.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= radius) {
        result.push(item);
      }
    }
    return result;
  }

  applyFreezeToItem(itemId: string, turns = 2): void {
    this.itemSystem.addModifier(itemId, { type: 'frozen', turnsRemaining: turns });
    this.physics.freezeBody(itemId);
  }

  applyLockToItem(itemId: string, scaffoldCount = 1): void {
    this.itemSystem.addModifier(itemId, { type: 'locked', scaffoldCount });
  }

  isItemSelectable(item: GameItem): boolean {
    return !item.modifiers.some(m => m.type === 'frozen' || m.type === 'locked');
  }
}
