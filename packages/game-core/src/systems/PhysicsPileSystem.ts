import type { GameItem, SpawnConfig, Vector3, Quaternion } from '../types/index.js';
import type { GameEventBus } from '../events/EventBus.js';

// Stub — replaced by VoxelPhysicsSystem in Phase 2.
export class PhysicsPileSystem {
  constructor(private readonly bus: GameEventBus) {}

  async init(): Promise<void> {}

  spawnPhysicsBody(
    item: GameItem,
    _spawnConfig: SpawnConfig
  ): { handle: number; position: Vector3; rotation: Quaternion } {
    return {
      handle: 0,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    };
  }

  removeBody(_itemId: string): void {}
  getBodyTransform(_itemId: string): { position: Vector3; rotation: Quaternion } | null { return null; }
  freezeBody(_itemId: string): void {}
  unfreezeBody(_itemId: string): void {}
  startSimulation(): void {}
  stopSimulation(): void {}
  getAllBodyTransforms(): Map<string, { position: Vector3; rotation: Quaternion }> { return new Map(); }
  destroy(): void {}
}
