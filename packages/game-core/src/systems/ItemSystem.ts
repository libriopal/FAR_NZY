import { v4 as uuidv4 } from 'uuid';
import type {
  GameItem,
  ItemDefinition,
  SpawnConfig,
  ItemModifier,
  ItemCategory,
} from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';

export class ItemSystem {
  private definitions = new Map<string, ItemDefinition>();
  private items = new Map<string, GameItem>();

  constructor(private readonly bus: GameEventBus) {}

  registerDefinitions(defs: ItemDefinition[]): void {
    for (const def of defs) {
      this.definitions.set(def.id, def);
    }
  }

  getDefinition(id: string): ItemDefinition | undefined {
    return this.definitions.get(id);
  }

  getAllDefinitions(): ItemDefinition[] {
    return Array.from(this.definitions.values());
  }

  spawnFromConfig(config: SpawnConfig): GameItem[] {
    const spawned: GameItem[] = [];
    const totalWeight = config.itemPoolWeights.reduce((s, w) => s + w.weight, 0);

    for (let i = 0; i < config.itemCount; i++) {
      const defId = this._weightedRandom(config.itemPoolWeights, totalWeight);
      const def = this.definitions.get(defId);
      if (!def) continue;

      const modifiers = this._generateModifiers(config.modifierConfig);
      const item = this._createItem(def, modifiers);
      this.items.set(item.id, item);
      spawned.push(item);
      this.bus.emit('item:spawned', item);
    }

    return spawned;
  }

  createItem(definitionId: string, modifiers: ItemModifier[] = []): GameItem | null {
    const def = this.definitions.get(definitionId);
    if (!def) return null;
    const item = this._createItem(def, modifiers);
    this.items.set(item.id, item);
    this.bus.emit('item:spawned', item);
    return item;
  }

  getItem(id: string): GameItem | undefined {
    return this.items.get(id);
  }

  removeItem(id: string, reason: 'match' | 'booster'): boolean {
    if (!this.items.has(id)) return false;
    this.items.delete(id);
    this.bus.emit('item:removed', { itemId: id, reason });
    return true;
  }

  addModifier(itemId: string, modifier: ItemModifier): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    item.modifiers.push(modifier);
    this.bus.emit('modifier:activated', { itemId, modifier });
    return true;
  }

  removeModifier(itemId: string, modifierType: ItemModifier['type']): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    const before = item.modifiers.length;
    item.modifiers = item.modifiers.filter(m => m.type !== modifierType);
    if (item.modifiers.length < before) {
      this.bus.emit('modifier:expired', { itemId, modifierType });
      return true;
    }
    return false;
  }

  updateItemPhysicsHandle(itemId: string, handle: number | null): void {
    const item = this.items.get(itemId);
    if (item) item.physicsBodyHandle = handle;
  }

  updateItemPosition(itemId: string, position: GameItem['position'], rotation: GameItem['rotation']): void {
    const item = this.items.get(itemId);
    if (!item) return;
    item.position = position;
    item.rotation = rotation;
  }

  placeInTray(itemId: string, slotIndex: number): boolean {
    const item = this.items.get(itemId);
    if (!item) return false;
    item.inTray = true;
    item.traySlotIndex = slotIndex;
    return true;
  }

  removeFromTray(itemId: string): void {
    const item = this.items.get(itemId);
    if (!item) return;
    item.inTray = false;
    item.traySlotIndex = null;
  }

  getItemsByCategory(category: ItemCategory): GameItem[] {
    return Array.from(this.items.values()).filter(i => i.category === category && !i.inTray);
  }

  getAllActiveItems(): GameItem[] {
    return Array.from(this.items.values());
  }

  getItemsInPile(): GameItem[] {
    return Array.from(this.items.values()).filter(i => !i.inTray);
  }

  clear(): void {
    this.items.clear();
  }

  private _createItem(def: ItemDefinition, modifiers: ItemModifier[]): GameItem {
    return {
      id: uuidv4(),
      definitionId: def.id,
      category: def.category,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      modifiers,
      physicsBodyHandle: null,
      inTray: false,
      traySlotIndex: null,
    };
  }

  private _weightedRandom(
    weights: Array<{ definitionId: string; weight: number }>,
    totalWeight: number
  ): string {
    let r = Math.random() * totalWeight;
    for (const w of weights) {
      r -= w.weight;
      if (r <= 0) return w.definitionId;
    }
    return weights[weights.length - 1]!.definitionId;
  }

  private _generateModifiers(
    config: SpawnConfig['modifierConfig']
  ): ItemModifier[] {
    const mods: ItemModifier[] = [];
    const r = Math.random();

    if (r < config.frozenProbability) {
      mods.push({ type: 'frozen', turnsRemaining: 2 });
    } else if (r < config.frozenProbability + config.lockedProbability) {
      mods.push({ type: 'locked', scaffoldCount: 1 });
    } else if (r < config.frozenProbability + config.lockedProbability + config.overgrowthProbability) {
      mods.push({ type: 'overgrowth', spreadRadius: 1.5, turnsToSpread: 3 });
    }

    return mods;
  }
}
