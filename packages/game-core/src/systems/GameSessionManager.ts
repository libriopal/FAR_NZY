import type { GameState, LevelConfig, GameItem, ItemDefinition, EstateUpgrade } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';
import { PhysicsPileSystem } from './PhysicsPileSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { TraySystem } from './TraySystem.js';
import { MatchSystem } from './MatchSystem.js';
import { ObjectiveSystem } from './ObjectiveSystem.js';
import { ModifierSystem } from './ModifierSystem.js';
import { MetaSystem } from './MetaSystem.js';
import { createGameEventBus } from '../events/EventBus.js';

export interface SessionConfig {
  itemDefinitions: ItemDefinition[];
  estateUpgrades: EstateUpgrade[];
  savedMeta?: { resources: import('../types/index.js').MetaResources; purchasedUpgradeIds: string[] };
}

export class GameSessionManager {
  readonly bus: GameEventBus;
  readonly physics: PhysicsPileSystem;
  readonly itemSystem: ItemSystem;
  readonly tray: TraySystem;
  readonly matchSystem: MatchSystem;
  readonly objectiveSystem: ObjectiveSystem;
  readonly modifierSystem: ModifierSystem;
  readonly metaSystem: MetaSystem;

  private state: GameState;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.bus = createGameEventBus();
    this.physics = new PhysicsPileSystem(this.bus);
    this.itemSystem = new ItemSystem(this.bus);
    this.tray = new TraySystem(this.bus);
    this.matchSystem = new MatchSystem(this.bus, this.tray, this.itemSystem);
    this.objectiveSystem = new ObjectiveSystem(this.bus);
    this.modifierSystem = new ModifierSystem(this.bus, this.itemSystem, this.physics);
    this.metaSystem = new MetaSystem(this.bus);

    this.state = this._blankState();
    this._bindCoreEvents();
  }

  async init(config: SessionConfig): Promise<void> {
    await this.physics.init();
    this.itemSystem.registerDefinitions(config.itemDefinitions);
    this.metaSystem.registerUpgrades(config.estateUpgrades);
    if (config.savedMeta) {
      this.metaSystem.deserialize(config.savedMeta);
    }
  }

  async startLevel(level: LevelConfig): Promise<void> {
    this._resetForLevel();
    this.state.level = level;
    this.state.phase = 'playing';
    this.state.timeRemaining = level.timerSeconds;
    this.objectiveSystem.loadObjectives(level.objectives);

    const spawnedItems = this.itemSystem.spawnFromConfig(level.spawnConfig);
    for (const item of spawnedItems) {
      const { handle, position, rotation } = this.physics.spawnPhysicsBody(item, level.spawnConfig);
      this.itemSystem.updateItemPhysicsHandle(item.id, handle);
      this.itemSystem.updateItemPosition(item.id, position, rotation);
      this.state.items.set(item.id, item);
    }

    this.physics.startSimulation();
    this._startTimer();
    this.bus.emit('level:started', level);
  }

  selectItem(itemId: string): void {
    if (this.state.phase !== 'playing') return;
    const item = this.itemSystem.getItem(itemId);
    if (!item || item.inTray) return;
    if (!this.modifierSystem.isItemSelectable(item)) return;

    this.bus.emit('item:selected', item);

    const result = this.tray.addItemWithOverflowCheck(item);
    if (result === 'overflow') {
      this._lose('overflow');
      return;
    }

    this.itemSystem.placeInTray(itemId, item.traySlotIndex!);
    this.physics.removeBody(itemId);

    const matches = this.matchSystem.checkAndResolveMatches();
    if (matches.length > 0) {
      this.modifierSystem.onMatchResolved();
      for (const match of matches) {
        this.state.score += match.scoreValue;
        this.state.matchHistory.push(match);
      }
      this.bus.emit('session:saved', { timestamp: Date.now() });
    }

    if (this.objectiveSystem.allCompleted() || this.itemSystem.getItemsInPile().length === 0) {
      this._win();
    }
  }

  pause(): void {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'paused';
    this._stopTimer();
    this.physics.stopSimulation();
    this.bus.emit('level:paused');
  }

  resume(): void {
    if (this.state.phase !== 'paused') return;
    this.state.phase = 'playing';
    this._startTimer();
    this.physics.startSimulation();
    this.bus.emit('level:resumed');
  }

  useBoosterClearTray(type: string): void {
    if (this.state.phase !== 'playing') return;
    const slots = this.tray.getSlots();
    const toRemove: [number, number, number] = [-1, -1, -1];
    // Remove last item in tray as "undo"
    const filled = slots.filter(s => s.item).slice(-3);
    if (filled.length === 0) return;
    for (let i = 0; i < 3 && i < filled.length; i++) {
      toRemove[i] = filled[i]!.index;
      this.itemSystem.removeItem(filled[i]!.item!.id, 'booster');
    }
    this.tray.removeItems(toRemove);
    this.bus.emit('booster:used', { type });
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getMetaSnapshot() {
    return this.metaSystem.serialize();
  }

  private _win(): void {
    this._stopTimer();
    this.physics.stopSimulation();
    this.state.phase = 'win';
    this.bus.emit('level:won', {
      score: this.state.score,
      timeRemaining: this.state.timeRemaining,
      objectivesCompleted: this.objectiveSystem.getObjectives().filter(o => o.completed).length,
    });
  }

  private _lose(reason: 'overflow' | 'timeout'): void {
    this._stopTimer();
    this.physics.stopSimulation();
    this.state.phase = 'lose';
    this.bus.emit('level:lost', { reason });
  }

  private _startTimer(): void {
    if (this.timerHandle) return;
    let last = Date.now();
    this.timerHandle = setInterval(() => {
      if (this.state.phase !== 'playing') return;
      const now = Date.now();
      const delta = (now - last) / 1000;
      last = now;
      this.state.timeRemaining = Math.max(0, this.state.timeRemaining - delta);
      this.objectiveSystem.tickTimer(delta * 1000);
      if (this.state.timeRemaining <= 0) {
        this._lose('timeout');
      }
    }, 250);
  }

  private _stopTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private _resetForLevel(): void {
    this._stopTimer();
    this.physics.stopSimulation();
    this.itemSystem.clear();
    this.tray.reset();
    this.matchSystem.resetCombo();
    this.objectiveSystem.reset();
    this.state = this._blankState();
  }

  private _bindCoreEvents(): void {
    this.bus.on('tray:overflow', () => {
      if (this.state.phase === 'playing') this._lose('overflow');
    });
  }

  private _blankState(): GameState {
    return {
      phase: 'idle',
      level: null,
      items: new Map(),
      tray: [],
      score: 0,
      timeRemaining: 0,
      objectives: [],
      matchHistory: [],
      sessionStartTime: Date.now(),
      comboCount: 0,
    };
  }

  destroy(): void {
    this._stopTimer();
    this.physics.destroy();
    this.bus.removeAllListeners();
  }
}
