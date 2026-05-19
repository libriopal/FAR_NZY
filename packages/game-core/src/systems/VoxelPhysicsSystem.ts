import type RAPIER from '@dimforge/rapier3d-compat';
import { seededRng } from '@match3d/farkle-engine';
import type { EntityType, SpawnWeights } from '@match3d/farkle-shared';
import { SPAWN_WEIGHTS, BOMB_CONSTANTS, MIRROR_OPPOSITES } from '@match3d/farkle-shared';

// ── Column layout ─────────────────────────────────────────────────────────────
const COLUMN_X = [-3, -2, -1, 0, 1, 2, 3] as const;
const GROUND_Y = 0;
const SPAWN_Y = 14;
const MAX_STACK_Y = 9.5;
const SETTLED_SPEED = 0.8;
// Body is considered at rest when speed is below this — skip constraint to allow sleep
const SLEEP_SPEED = 0.12;
const OVERFLOW_GRACE_MS = 4000;
const DIE_HALF = 0.46;
const SPHERE_RADIUS = 0.43;
const LOCK_MAX_HP = 3;
const STONE_HP = 3;
// Max bodies per column — reduced from 6 to keep board readable
const MAX_COL_BODIES = 4;
// Height above which a column is considered full for fill purposes
const FILL_HEIGHT_CAP = 4.5;
// Ghost drift: gentle horizontal force toward lowest-height column each step
const GHOST_DRIFT_FORCE = 0.8;

interface VoxelBodyData {
  id: string;
  column: number;        // logical column (0–6); ghost updates this dynamically
  entityType: EntityType;
  face: number | null;
  health: number;        // lock/stone HP; 0 = broken
  isGhost: boolean;      // ghost bodies skip column constraint
  handle: number;
  spawnedAt: number;     // Date.now() at spawn — used for bomb fuse countdown (C10)
}

export interface VoxelTransform {
  id: string;
  entityType: EntityType;
  face: number | null;
  health: number;
  column: number;
  spawnedAt: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

export interface BombBlastResult {
  removedIds: string[];
  scoreGained: number;
  energyGained: number;
  pushedSphereIds: string[];  // spheres shockwave-pushed but not destroyed
}

export interface StoneDestroyResult {
  id: string;
  bioSteelReward: number;
}

export class VoxelPhysicsSystem {
  private world!: RAPIER.World;
  private rapier!: typeof RAPIER;
  private bodies = new Map<string, VoxelBodyData>();
  private stepInterval: ReturnType<typeof setInterval> | null = null;
  private spawnInterval: ReturnType<typeof setInterval> | null = null;
  private rng: () => number;
  private faceRng: () => number;
  private onStep: ((transforms: VoxelTransform[]) => void) | null = null;
  private idCounter = 0;
  private simulationStartedAt = 0;
  private overflowTicks = 0;
  private spawnWeights: SpawnWeights = SPAWN_WEIGHTS.NORMAL;
  // Accumulates catalyst boosts over the session
  private wildcardBoostPct = 0;

  private constructor(seed: number) {
    this.rng = seededRng(seed);
    this.faceRng = seededRng(seed ^ 0x55aa55aa);
  }

  static async create(seed = Date.now()): Promise<VoxelPhysicsSystem> {
    const sys = new VoxelPhysicsSystem(seed);
    await sys._init();
    return sys;
  }

  private async _init(): Promise<void> {
    const rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
    this.rapier = rapier;

    this.world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 30;

    const groundDesc = rapier.RigidBodyDesc.fixed().setTranslation(0, GROUND_Y - 0.5, 0);
    const ground = this.world.createRigidBody(groundDesc);
    this.world.createCollider(rapier.ColliderDesc.cuboid(10, 0.5, 2), ground);

    const leftWall = rapier.RigidBodyDesc.fixed().setTranslation(-3.7, 5, 0);
    const lw = this.world.createRigidBody(leftWall);
    this.world.createCollider(rapier.ColliderDesc.cuboid(0.1, 6, 2), lw);

    const rightWall = rapier.RigidBodyDesc.fixed().setTranslation(3.7, 5, 0);
    const rw = this.world.createRigidBody(rightWall);
    this.world.createCollider(rapier.ColliderDesc.cuboid(0.1, 6, 2), rw);
  }

  // ── Spawn weight control ──────────────────────────────────────────────────

  setSpawnWeights(weights: SpawnWeights): void {
    // Apply any accumulated catalyst bonus to wild weight
    const boosted = {
      ...weights,
      wild: Math.min(weights.wild + this.wildcardBoostPct, weights.wild + 10),
      // Proportionally reduce die to absorb the extra wild weight
      die: Math.max(0, weights.die - this.wildcardBoostPct),
    };
    this.spawnWeights = boosted;
  }

  applyWildcardBoost(addedPct: number): void {
    this.wildcardBoostPct = Math.min(this.wildcardBoostPct + addedPct, 10);
  }

  getWildcardBoostPct(): number { return this.wildcardBoostPct; }

  // ── Provably fair entity type selection ──────────────────────────────────

  private _rollEntityType(): EntityType {
    const w = this.spawnWeights;
    const total = w.die + w.sphere + w.ice + w.lock + w.wild + w.bomb + w.rainbow_bomb
                + w.mirror + w.stone + w.multiplier_orb + w.ghost + w.catalyst;
    let roll = this.rng() * total;
    if ((roll -= w.die) < 0)            return 'die';
    if ((roll -= w.sphere) < 0)         return 'sphere';
    if ((roll -= w.ice) < 0)            return 'ice';
    if ((roll -= w.lock) < 0)           return 'lock';
    if ((roll -= w.wild) < 0)           return 'wild';
    if ((roll -= w.bomb) < 0)           return 'bomb';
    if ((roll -= w.rainbow_bomb) < 0)   return 'rainbow_bomb';
    if ((roll -= w.mirror) < 0)         return 'mirror';
    if ((roll -= w.stone) < 0)          return 'stone';
    if ((roll -= w.multiplier_orb) < 0) return 'multiplier_orb';
    if ((roll -= w.ghost) < 0)          return 'ghost';
    return 'catalyst';
  }

  private _rollFace(): number {
    return Math.floor(this.faceRng() * 6) + 1;
  }

  // ── Body spawning ─────────────────────────────────────────────────────────

  spawnBody(column: number, entityType: EntityType, face?: number): string {
    const R = this.rapier;
    const x = COLUMN_X[column] ?? 0;
    const id = `vb-${++this.idCounter}`;

    // Ghost spawns slightly offset so it doesn't immediately snap
    const spawnX = entityType === 'ghost' ? x + (this.rng() - 0.5) * 2 : x;

    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(spawnX, SPAWN_Y, 0)
      .setLinearDamping(entityType === 'ghost' ? 0.2 : 1.2)
      .setAngularDamping(entityType === 'ghost' ? 0.8 : 8.0)
      .setCcdEnabled(true);

    const body = this.world.createRigidBody(bodyDesc);

    const isSphereShape = entityType === 'sphere' || entityType === 'multiplier_orb' || entityType === 'ghost';
    const collider = isSphereShape
      ? R.ColliderDesc.ball(SPHERE_RADIUS).setRestitution(0.3).setFriction(0.7)
      : R.ColliderDesc.cuboid(DIE_HALF, DIE_HALF, DIE_HALF).setRestitution(0.1).setFriction(1.0);

    this.world.createCollider(collider, body);

    // Face assignment per entity type
    let resolvedFace: number | null = null;
    const needsFace: EntityType[] = ['die', 'ice', 'lock', 'mirror', 'ghost', 'catalyst'];
    if (needsFace.includes(entityType)) {
      resolvedFace = face ?? this._rollFace();
    } else if (entityType === 'wild') {
      resolvedFace = 0; // 0 signals wild in rendering
    }

    const health = entityType === 'lock' ? LOCK_MAX_HP
      : entityType === 'stone' ? STONE_HP
      : 0;

    this.bodies.set(id, {
      id, column, entityType,
      face: resolvedFace, health,
      isGhost: entityType === 'ghost',
      handle: body.handle,
      spawnedAt: Date.now(),
    });

    return id;
  }

  spawnRandom(): string {
    const heights = this._columnHeights();
    const minH = Math.min(...heights);
    const candidates = heights
      .map((h, i) => ({ i, h }))
      .filter(c => c.h < MAX_STACK_Y);
    if (candidates.length === 0) return '';
    const lowest = candidates.filter(c => c.h === minH);
    const pick = lowest[Math.floor(this.rng() * lowest.length)];
    if (!pick) return '';
    return this.spawnBody(pick.i, this._rollEntityType());
  }

  // ── Body removal ──────────────────────────────────────────────────────────

  removeBody(id: string): void {
    const data = this.bodies.get(id);
    if (!data) return;
    const body = this.world.getRigidBody(data.handle);
    if (body) this.world.removeRigidBody(body);
    this.bodies.delete(id);
  }

  // ── Ghost: anchor into nearest column → becomes normal die ───────────────

  anchorGhost(id: string): boolean {
    const data = this.bodies.get(id);
    if (!data || data.entityType !== 'ghost') return false;
    const body = this.world.getRigidBody(data.handle);
    if (!body) return false;

    // Snap to nearest column
    const x = body.translation().x;
    let nearest = 0;
    let minDist = Infinity;
    for (let c = 0; c < 7; c++) {
      const dist = Math.abs(x - (COLUMN_X[c] ?? 0));
      if (dist < minDist) { minDist = dist; nearest = c; }
    }

    data.column = nearest;
    data.entityType = 'die';
    data.isGhost = false;
    body.setTranslation({ x: COLUMN_X[nearest] ?? 0, y: body.translation().y, z: 0 }, true);
    body.setLinvel({ x: 0, y: body.linvel().y, z: 0 }, true);
    return true;
  }

  // ── Ice: thaw adjacent ice on chain commit ────────────────────────────────

  thawAdjacentIce(committedIds: string[]): string[] {
    const thawed: string[] = [];
    const committed = committedIds
      .map(id => this.bodies.get(id))
      .filter((b): b is VoxelBodyData => b !== undefined);
    const affectedCols = new Set(committed.map(b => b.column));
    const affectedYs = committed
      .map(b => this.world.getRigidBody(b.handle)?.translation().y ?? 0);

    for (const [, data] of this.bodies) {
      if (data.entityType !== 'ice') continue;
      const inRange = [...affectedCols].some(col => Math.abs(data.column - col) <= 1);
      if (!inRange) continue;
      const rb = this.world.getRigidBody(data.handle);
      if (!rb) continue;
      const bodyY = rb.translation().y;
      const yClose = affectedYs.some(y => Math.abs(bodyY - y) <= 2.0);
      if (!yClose) continue;
      data.entityType = 'die';
      thawed.push(data.id);
    }
    return thawed;
  }

  // ── Lock: damage locks in committed columns ───────────────────────────────

  damageLockInColumns(committedIds: string[]): string[] {
    const unlocked: string[] = [];
    const cols = new Set(
      committedIds
        .map(id => this.bodies.get(id)?.column ?? -1)
        .filter(c => c >= 0),
    );
    for (const [, data] of this.bodies) {
      if (data.entityType !== 'lock') continue;
      if (!cols.has(data.column)) continue;
      data.health = Math.max(0, data.health - 1);
      if (data.health === 0) {
        data.entityType = 'die';
        unlocked.push(data.id);
      }
    }
    return unlocked;
  }

  // ── Bomb: blast radius ────────────────────────────────────────────────────

  activateBomb(bombId: string, targetFace?: number): BombBlastResult & { stoneHits: StoneDestroyResult[] } {
    const bombData = this.bodies.get(bombId);
    const empty = { removedIds: [], scoreGained: 0, energyGained: 0, stoneHits: [], pushedSphereIds: [] };
    if (!bombData || bombData.entityType !== 'bomb') return empty;
    const bombRb = this.world.getRigidBody(bombData.handle);
    if (!bombRb) return empty;

    const bombY = bombRb.translation().y;
    const bombCol = bombData.column;
    const R = BOMB_CONSTANTS.STANDARD_RADIUS;

    const toRemove: string[] = [];
    const pushedSpheres: string[] = [];
    const stoneHits: StoneDestroyResult[] = [];
    let score = BOMB_CONSTANTS.SELF_PTS;
    let energy = 0;

    for (const [id, data] of this.bodies) {
      if (id === bombId) continue;
      // RAINMAKER face-targeted mode: global face match, skip radius/y checks for die entities
      if (targetFace !== undefined) {
        if ((data.entityType === 'die' || data.entityType === 'ice' || data.entityType === 'mirror') && data.face === targetFace) {
          if (data.face === 1) score += BOMB_CONSTANTS.DIE_PTS_ONE;
          else if (data.face === 5) score += BOMB_CONSTANTS.DIE_PTS_FIVE;
          toRemove.push(id);
        }
        continue;
      }
      if (Math.abs(data.column - bombCol) > R) continue;
      const rb = this.world.getRigidBody(data.handle);
      if (!rb || Math.abs(rb.translation().y - bombY) > 1.5) continue;

      switch (data.entityType) {
        case 'sphere': {
          // Spec: spheres are NOT destroyable — push away from blast center instead
          const colDiff = data.column - bombCol;
          const pushX = colDiff !== 0 ? Math.sign(colDiff) * 4.5 : (this.rng() > 0.5 ? 4.5 : -4.5);
          rb.applyImpulse({ x: pushX, y: 3.8, z: (this.rng() - 0.5) * 1.2 }, true);
          pushedSpheres.push(id);
          break;
        }
        case 'multiplier_orb': energy += BOMB_CONSTANTS.MULTIPLIER_ORB_ENERGY; toRemove.push(id); break;
        case 'lock':           score += BOMB_CONSTANTS.LOCK_PTS; toRemove.push(id); break;
        case 'wild':           score += BOMB_CONSTANTS.WILD_PTS; toRemove.push(id); break;
        case 'mirror':         score += BOMB_CONSTANTS.MIRROR_PTS; toRemove.push(id); break;
        case 'catalyst':       score += BOMB_CONSTANTS.CATALYST_PTS; toRemove.push(id); break;
        case 'stone': {
          data.health = Math.max(0, data.health - 1);
          if (data.health === 0) {
            stoneHits.push({ id, bioSteelReward: 8 });
            toRemove.push(id);
          }
          score += BOMB_CONSTANTS.STONE_PTS;
          break;
        }
        case 'ice':
          data.entityType = 'die'; // thaw instead of remove
          break;
        case 'bomb':
        case 'rainbow_bomb':
          toRemove.push(id); // caught in blast, no score
          break;
        default:
          // Farkle-consistent die scoring: 1s=100, 5s=50, others=0
          if (data.face === 1) score += BOMB_CONSTANTS.DIE_PTS_ONE;
          else if (data.face === 5) score += BOMB_CONSTANTS.DIE_PTS_FIVE;
          toRemove.push(id);
          break;
      }
    }

    this.removeBody(bombId);
    for (const id of toRemove) this.removeBody(id);
    return { removedIds: [bombId, ...toRemove], scoreGained: score, energyGained: energy, stoneHits, pushedSphereIds: pushedSpheres };
  }

  // ── Rainbow Bomb ──────────────────────────────────────────────────────────

  activateRainbowBomb(bombId: string, targetFace?: number): BombBlastResult {
    const bombData = this.bodies.get(bombId);
    const empty = { removedIds: [], scoreGained: 0, energyGained: 0, pushedSphereIds: [] };
    if (!bombData || bombData.entityType !== 'rainbow_bomb') return empty;

    let face = targetFace;
    if (!face) {
      // Collect all face values currently in play, then pick one at random
      const inPlay = new Set<number>();
      for (const [, d] of this.bodies) {
        if ((d.entityType === 'die' || d.entityType === 'ice' || d.entityType === 'mirror') && d.face) {
          inPlay.add(d.face);
        }
      }
      const candidates = [...inPlay];
      if (candidates.length > 0) {
        face = candidates[Math.floor(this.rng() * candidates.length)];
      }
    }

    if (!face) {
      this.removeBody(bombId);
      return { removedIds: [bombId], scoreGained: 0, energyGained: 0, pushedSphereIds: [] };
    }

    const toRemove: string[] = [];
    let score = 0;
    for (const [id, data] of this.bodies) {
      if (id === bombId) continue;
      if ((data.entityType === 'die' || data.entityType === 'ice' || data.entityType === 'mirror') && data.face === face) {
        toRemove.push(id);
        // Farkle-consistent scoring: 1s=100, 5s=50, others=0
        if (data.face === 1) score += BOMB_CONSTANTS.DIE_PTS_ONE;
        else if (data.face === 5) score += BOMB_CONSTANTS.DIE_PTS_FIVE;
      }
    }

    this.removeBody(bombId);
    for (const id of toRemove) this.removeBody(id);
    return { removedIds: [bombId, ...toRemove], scoreGained: score, energyGained: 0, pushedSphereIds: [] };
  }

  // ── Sphere resnap after shockwave push ───────────────────────────────────────

  resnap(bodyId: string): void {
    const data = this.bodies.get(bodyId);
    if (!data) return;
    const rb = this.world.getRigidBody(data.handle);
    if (!rb) return;
    const targetX = COLUMN_X[data.column] ?? (data.column - 3);
    const pos = rb.translation();
    rb.setLinvel({ x: 0, y: Math.max(0, rb.linvel().y), z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    rb.setTranslation({ x: targetX, y: pos.y, z: pos.z }, true);
  }

  // ── Mirror: resolve effective face in a chain ─────────────────────────────

  resolveMirrorFace(mirrorId: string, chainIds: string[], chainFaces: number[]): number {
    const idx = chainIds.indexOf(mirrorId);
    if (idx < 0) return 1;
    // Neighbor preference: previous die first, then next
    const neighborFace = chainFaces[idx - 1] ?? chainFaces[idx + 1] ?? 1;
    return MIRROR_OPPOSITES[neighborFace] ?? neighborFace;
  }

  // ── Wild: resolve effective face in a chain ───────────────────────────────

  resolveWildFace(chainFaces: number[]): number {
    if (chainFaces.length === 0) return 1;
    const counts: Record<number, number> = {};
    for (const f of chainFaces) counts[f] = (counts[f] ?? 0) + 1;
    let best = 1; let bestC = 0;
    for (const [f, c] of Object.entries(counts)) {
      if (c > bestC) { bestC = c; best = Number(f); }
    }
    return best;
  }

  // ── Transforms ────────────────────────────────────────────────────────────

  getAllTransforms(): VoxelTransform[] {
    const result: VoxelTransform[] = [];
    for (const [, data] of this.bodies) {
      const body = this.world.getRigidBody(data.handle);
      if (!body) continue;
      const t = body.translation();
      const r = body.rotation();
      result.push({
        id: data.id,
        entityType: data.entityType,
        face: data.face,
        health: data.health,
        column: data.column,
        spawnedAt: data.spawnedAt,
        position: { x: t.x, y: t.y, z: t.z },
        rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
      });
    }
    return result;
  }

  getColumnOfBody(id: string): number { return this.bodies.get(id)?.column ?? -1; }
  getEntityType(id: string): EntityType | null { return this.bodies.get(id)?.entityType ?? null; }
  getHealth(id: string): number { return this.bodies.get(id)?.health ?? 0; }

  getWildCount(): number {
    let n = 0;
    for (const [, d] of this.bodies) { if (d.entityType === 'wild') n++; }
    return n;
  }

  // C4: Wild Scatter — destroys all 'die' tiles whose face is in the provided set.
  destroyBodiesByFace(faces: number[]): string[] {
    const faceSet = new Set(faces);
    const toDestroy: string[] = [];
    for (const [id, data] of this.bodies) {
      if (data.entityType === 'die' && data.face !== null && faceSet.has(data.face)) {
        toDestroy.push(id);
      }
    }
    for (const id of toDestroy) this.removeBody(id);
    return toDestroy;
  }

  sendDisruption(targetColumns: number[], type: 'ice_send' | 'lock_send' | 'scramble'): void {
    for (const col of targetColumns) {
      if (col < 0 || col > 6) continue;
      if (type === 'ice_send') {
        this.spawnBody(col, 'ice');
      } else if (type === 'lock_send') {
        this.spawnBody(col, 'lock');
      } else if (type === 'scramble') {
        // Re-roll faces of all settled dice in this column
        for (const [, data] of this.bodies) {
          if (data.column === col && data.entityType === 'die') {
            data.face = this._rollFace();
          }
        }
      }
    }
  }

  // ── Simulation ────────────────────────────────────────────────────────────

  startSimulation(
    onStep: (transforms: VoxelTransform[]) => void,
    onOverflow?: () => void,
  ): void {
    if (this.stepInterval) return;
    this.onStep = onStep;
    this.simulationStartedAt = Date.now();

    this.stepInterval = setInterval(() => {
      try {
        this.world.step();
        this._applyColumnConstraint();
        this._applyGhostDrift();
        const graceOk = Date.now() - this.simulationStartedAt > OVERFLOW_GRACE_MS;
        if (graceOk && onOverflow) {
          if (this._checkOverflow()) {
            if (++this.overflowTicks >= 10) onOverflow();
          } else {
            this.overflowTicks = 0;
          }
        }
        if (this.onStep) this.onStep(this.getAllTransforms());
      } catch (err) {
        console.error('[VoxelPhysics] step error:', err);
      }
    }, 1000 / 30);

    this.spawnInterval = setInterval(() => this._fillColumns(), 800);
  }

  stopSimulation(): void {
    if (this.stepInterval) { clearInterval(this.stepInterval); this.stepInterval = null; }
    if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
    this.onStep = null;
  }

  destroy(): void {
    this.stopSimulation();
    this.bodies.clear();
  }

  setDieFace(id: string, face: number): void {
    const data = this.bodies.get(id);
    if (data && ['die', 'ice', 'lock', 'mirror', 'ghost', 'catalyst'].includes(data.entityType)) {
      data.face = face;
    }
  }

  isDeadBoard(): boolean {
    // Wilds, bombs, mirrors, and catalysts always provide a move
    for (const [, data] of this.bodies) {
      if (['wild','bomb','rainbow_bomb','mirror','catalyst','multiplier_orb'].includes(data.entityType)) return false;
    }
    const faceCounts: Record<number, number> = {};
    for (const [, data] of this.bodies) {
      if (data.entityType !== 'die' || data.face === null) continue;
      if (data.face === 1 || data.face === 5) return false;
      faceCounts[data.face] = (faceCounts[data.face] ?? 0) + 1;
      if ((faceCounts[data.face] ?? 0) >= 3) return false;
    }
    return true;
  }

  reshuffleBoard(): void {
    for (const [, data] of this.bodies) {
      if (['die','ice','lock','mirror','ghost','catalyst'].includes(data.entityType)) {
        data.face = Math.ceil(this.faceRng() * 6);
      }
    }
  }

  getColumnHeights(): number[] { return this._columnHeights(); }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _checkOverflow(): boolean {
    for (const [, data] of this.bodies) {
      if (data.isGhost) continue; // ghosts don't count toward overflow
      const body = this.world.getRigidBody(data.handle);
      if (!body || !body.isDynamic()) continue;
      if (Math.abs(body.linvel().y) > SETTLED_SPEED) continue;
      if (body.translation().y > MAX_STACK_Y) return true;
    }
    return false;
  }

  private _applyColumnConstraint(): void {
    for (const [, data] of this.bodies) {
      if (data.isGhost) continue;
      const body = this.world.getRigidBody(data.handle);
      if (!body || !body.isDynamic()) continue;
      const v = body.linvel();
      const av = body.angvel();
      const speed = Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z);
      const spin = Math.abs(av.x) + Math.abs(av.y) + Math.abs(av.z);
      // Skip settled bodies — let Rapier sleep them naturally
      if (speed < SLEEP_SPEED && spin < SLEEP_SPEED) continue;
      const t = body.translation();
      const targetX = COLUMN_X[data.column] ?? 0;
      body.setTranslation({ x: targetX, y: t.y, z: 0 }, false);
      body.setLinvel({ x: 0, y: v.y, z: 0 }, false);
      // Kill spin almost entirely once the body is nearly still
      body.setAngvel({ x: 0, y: 0, z: av.z * 0.05 }, false);
    }
  }

  private _applyGhostDrift(): void {
    const heights = this._columnHeights();
    let lowestCol = 0;
    let lowestH = Infinity;
    for (let i = 0; i < 7; i++) {
      if ((heights[i] ?? 0) < lowestH) { lowestH = heights[i] ?? 0; lowestCol = i; }
    }
    const targetX = COLUMN_X[lowestCol] ?? 0;

    for (const [, data] of this.bodies) {
      if (!data.isGhost) continue;
      const body = this.world.getRigidBody(data.handle);
      if (!body || !body.isDynamic()) continue;
      const dx = targetX - body.translation().x;
      // Gentle impulse toward lowest column
      body.applyImpulse({ x: dx * GHOST_DRIFT_FORCE * 0.01, y: 0, z: 0 }, true);
      // Update logical column to nearest X
      const bx = body.translation().x;
      let nearest = 0; let minD = Infinity;
      for (let c = 0; c < 7; c++) {
        const d = Math.abs(bx - (COLUMN_X[c] ?? 0));
        if (d < minD) { minD = d; nearest = c; }
      }
      data.column = nearest;
    }
  }

  private _columnHeights(): number[] {
    const heights = COLUMN_X.map(() => GROUND_Y) as number[];
    for (const [, data] of this.bodies) {
      if (data.isGhost) continue;
      const body = this.world.getRigidBody(data.handle);
      if (!body) continue;
      const y = body.translation().y;
      if (y > (heights[data.column] ?? 0)) heights[data.column] = y;
    }
    return heights;
  }

  private _fillColumns(): void {
    const colCounts = new Array(7).fill(0) as number[];
    const settledHeights = new Array(7).fill(GROUND_Y) as number[];

    for (const [, data] of this.bodies) {
      if (!data.isGhost) colCounts[data.column] = (colCounts[data.column] ?? 0) + 1;
      const body = this.world.getRigidBody(data.handle);
      if (!body || !body.isDynamic() || data.isGhost) continue;
      if (Math.abs(body.linvel().y) > SETTLED_SPEED) continue;
      const y = body.translation().y;
      if (y > (settledHeights[data.column] ?? 0)) settledHeights[data.column] = y;
    }

    for (let col = 0; col < 7; col++) {
      if ((colCounts[col] ?? 0) >= MAX_COL_BODIES) continue;
      if ((settledHeights[col] ?? 0) >= FILL_HEIGHT_CAP) continue;
      this.spawnBody(col, this._rollEntityType());
    }
  }
}
