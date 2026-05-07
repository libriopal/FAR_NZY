import type { TraySlot, GameItem } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';

const TRAY_MAX_SLOTS = 7;

export class TraySystem {
  private slots: TraySlot[] = [];

  constructor(private readonly bus: GameEventBus) {
    this._initSlots();
  }

  private _initSlots(): void {
    this.slots = Array.from({ length: TRAY_MAX_SLOTS }, (_, i) => ({
      index: i,
      item: null,
      reservedFor: null,
    }));
  }

  getSlots(): TraySlot[] {
    return this.slots;
  }

  getFilledCount(): number {
    return this.slots.filter(s => s.item !== null).length;
  }

  isFull(): boolean {
    return this.slots.every(s => s.item !== null);
  }

  hasCapacity(): boolean {
    return this.slots.some(s => s.item === null);
  }

  getFirstEmptyIndex(): number | null {
    const slot = this.slots.find(s => s.item === null);
    return slot ? slot.index : null;
  }

  addItem(item: GameItem): { slotIndex: number } | null {
    const idx = this.getFirstEmptyIndex();
    if (idx === null) return null;

    this.slots[idx]!.item = item;
    this.bus.emit('item:placed-in-tray', { item, slotIndex: idx });
    this.bus.emit('tray:updated', [...this.slots]);
    return { slotIndex: idx };
  }

  // Attempt to add item; if tray is full after adding, emit overflow
  addItemWithOverflowCheck(item: GameItem): 'placed' | 'overflow' {
    const result = this.addItem(item);
    if (result === null) {
      this.bus.emit('tray:overflow', { item });
      return 'overflow';
    }
    return 'placed';
  }

  removeItems(slotIndices: [number, number, number]): void {
    for (const idx of slotIndices) {
      if (idx >= 0 && idx < TRAY_MAX_SLOTS) {
        this.slots[idx]!.item = null;
      }
    }
    // Compact: shift items left to fill gaps
    this._compact();
    this.bus.emit('tray:updated', [...this.slots]);
  }

  private _compact(): void {
    const filled = this.slots.filter(s => s.item !== null).map(s => s.item!);
    for (let i = 0; i < TRAY_MAX_SLOTS; i++) {
      const slot = this.slots[i]!;
      slot.item = filled[i] ?? null;
      if (slot.item) slot.item.traySlotIndex = i;
    }
  }

  detectTriples(): Array<{ definitionId: string; slots: [number, number, number] }> {
    const byDef = new Map<string, number[]>();
    for (const slot of this.slots) {
      if (!slot.item) continue;
      const defId = slot.item.definitionId;
      const arr = byDef.get(defId) ?? [];
      arr.push(slot.index);
      byDef.set(defId, arr);
    }

    const matches: Array<{ definitionId: string; slots: [number, number, number] }> = [];
    for (const [defId, indices] of byDef) {
      if (indices.length >= 3) {
        matches.push({ definitionId: defId, slots: [indices[0]!, indices[1]!, indices[2]!] });
      }
    }
    return matches;
  }

  getItemAtSlot(index: number): GameItem | null {
    return this.slots[index]?.item ?? null;
  }

  reset(): void {
    this._initSlots();
    this.bus.emit('tray:updated', [...this.slots]);
  }

  getSnapshot(): TraySlot[] {
    return this.slots.map(s => ({ ...s }));
  }
}
