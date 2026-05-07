import type { MetaResources, EstateUpgrade, ResourceType } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';

export class MetaSystem {
  private resources: MetaResources = {
    bioSteel: 0,
    aeroSeeds: 0,
    goldCoins: 0,
    sweepsCoins: 0,
  };

  private upgrades = new Map<string, EstateUpgrade>();
  private purchasedUpgradeIds = new Set<string>();

  constructor(private readonly bus: GameEventBus) {
    this._bindEvents();
  }

  private _bindEvents(): void {
    this.bus.on('match:resolved', (result) => {
      for (const [type, amount] of Object.entries(result.resourceReward) as Array<[ResourceType, number]>) {
        if (amount > 0) this.addResource(type, amount);
      }
    });
  }

  registerUpgrades(upgrades: EstateUpgrade[]): void {
    for (const u of upgrades) {
      this.upgrades.set(u.id, u);
    }
  }

  setResources(resources: Partial<MetaResources>): void {
    Object.assign(this.resources, resources);
  }

  addResource(type: ResourceType, amount: number): void {
    this.resources[type] = (this.resources[type] ?? 0) + amount;
    this.bus.emit('meta:resource-gained', {
      type,
      amount,
      newTotal: this.resources[type],
    });
  }

  spendResource(type: ResourceType, amount: number): boolean {
    if ((this.resources[type] ?? 0) < amount) return false;
    this.resources[type] -= amount;
    this.bus.emit('meta:resource-spent', {
      type,
      amount,
      newTotal: this.resources[type],
    });
    return true;
  }

  getResource(type: ResourceType): number {
    return this.resources[type] ?? 0;
  }

  getResources(): MetaResources {
    return { ...this.resources };
  }

  canPurchaseUpgrade(upgradeId: string): boolean {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return false;
    if (this.purchasedUpgradeIds.has(upgradeId)) return false;

    // Check prerequisites
    for (const prereqId of upgrade.prerequisiteIds) {
      if (!this.purchasedUpgradeIds.has(prereqId)) return false;
    }

    // Check cost
    for (const [type, amount] of Object.entries(upgrade.cost) as Array<[ResourceType, number]>) {
      if ((this.resources[type] ?? 0) < amount) return false;
    }

    return true;
  }

  purchaseUpgrade(upgradeId: string): boolean {
    if (!this.canPurchaseUpgrade(upgradeId)) return false;
    const upgrade = this.upgrades.get(upgradeId)!;

    for (const [type, amount] of Object.entries(upgrade.cost) as Array<[ResourceType, number]>) {
      this.spendResource(type, amount);
    }

    this.purchasedUpgradeIds.add(upgradeId);
    this.bus.emit('meta:upgrade-purchased', upgrade);
    return true;
  }

  getPurchasedUpgradeIds(): string[] {
    return Array.from(this.purchasedUpgradeIds);
  }

  isUpgradePurchased(id: string): boolean {
    return this.purchasedUpgradeIds.has(id);
  }

  getAvailableUpgrades(): EstateUpgrade[] {
    return Array.from(this.upgrades.values()).filter(u =>
      !this.purchasedUpgradeIds.has(u.id) &&
      u.prerequisiteIds.every(p => this.purchasedUpgradeIds.has(p))
    );
  }

  serialize(): { resources: MetaResources; purchasedUpgradeIds: string[] } {
    return {
      resources: { ...this.resources },
      purchasedUpgradeIds: Array.from(this.purchasedUpgradeIds),
    };
  }

  deserialize(data: { resources: MetaResources; purchasedUpgradeIds: string[] }): void {
    this.resources = { ...data.resources };
    this.purchasedUpgradeIds = new Set(data.purchasedUpgradeIds);
  }
}
