import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { buildScoreTable, lookupScore } from '@match3d/farkle-engine';
import type { DieFace, LevelDef } from '@match3d/farkle-shared';
import { SPAWN_WEIGHTS, CATALYST_WILD_BOOST, CATALYST_MAX_BOOST } from '@match3d/farkle-shared';
import type { VoxelPhysicsSystem } from '@match3d/game-core';
import { useFarkleStore, MAX_CHAIN } from '../store/farkleStore.js';

export const WIN_SCORE = 100_000;

// Entities that CAN be included in a drag-chain
const CHAINABLE: Set<string> = new Set(['die', 'wild', 'mirror', 'catalyst']);
// Entities handled by tap (not chain)
const TAPPABLE: Set<string> = new Set(['sphere', 'bomb', 'rainbow_bomb', 'multiplier_orb', 'ghost']);

let _table: Int32Array | null = null;
function getTable(): Int32Array {
  if (!_table) _table = buildScoreTable();
  return _table;
}

export function useFarkleGame(
  physicsRef: MutableRefObject<VoxelPhysicsSystem | null>,
  levelDef?: LevelDef,
) {
  const store = useFarkleStore;
  const isDragging = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const deadBoardAttemptsRef = useRef(0);
  const bankCountRef = useRef(0);
  const frenzyDoublerSpawnedRef = useRef(false);
  const effectiveWinScore = levelDef?.winScore ?? WIN_SCORE;
  const effectiveEnergyMult = levelDef?.energyMultiplier ?? 1.0;

  // ── Energy RAF tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      const elapsed = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const { mode, gamePhase, doublerCells } = store.getState();
      if (gamePhase === 'playing') {
        if (mode === 'PRIME') store.getState().addEnergy(5 * elapsed);
        else if (mode === 'FRENZY') store.getState().addEnergy(-5 * elapsed);
      }
      // Expire stale doubler cells
      if (doublerCells.length > 0) {
        const alive = doublerCells.filter(d => d.expiresAt > now);
        if (alive.length !== doublerCells.length) {
          store.setState({ doublerCells: alive });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  // ── Sync spawn weights to physics when mode changes ─────────────────────────
  useEffect(() => {
    return store.subscribe(
      s => s.mode,
      (mode) => {
        const physics = physicsRef.current;
        if (!physics) return;
        const base = SPAWN_WEIGHTS[mode];
        physics.setSpawnWeights(base);
      },
    );
  }, [physicsRef]);

  // ── Doubler cell: spawn 2 random columns on first FRENZY entry ───────────────
  useEffect(() => {
    return store.subscribe(
      s => s.mode,
      (mode, prev) => {
        if (mode === 'FRENZY' && prev !== 'FRENZY' && !frenzyDoublerSpawnedRef.current) {
          frenzyDoublerSpawnedRef.current = true;
          const cols = _randomColumns(2);
          for (const col of cols) store.getState().spawnDoublerCell(col, 12_000);
        }
      },
    );
  }, []);

  // ── Chain score sync (resolve wild/mirror faces before lookup) ──────────────
  useEffect(() => {
    return store.subscribe(
      s => s.chainFaces,
      (faces) => {
        if (faces.length === 0) { store.setState({ chainScore: 0 }); return; }
        // Resolve wild and mirror placeholders for scoring preview
        const resolved = _resolveChainFaces(faces);
        const score = lookupScore(resolved as DieFace[], getTable());
        store.setState({ chainScore: score });
      },
    );
  }, []);

  // ── Chain drag API ───────────────────────────────────────────────────────────

  const startChain = useCallback((bodyId: string, face: number, _column: number) => {
    const s = store.getState();
    if (s.gamePhase !== 'playing') return;
    const body = s.bodies.find(b => b.id === bodyId);
    if (!body || !CHAINABLE.has(body.entityType)) return;
    if (body.entityType === 'lock' && body.health > 0) return;
    // NORMAL mode: only face 1 or 5 can be selected (single-die tap-score only)
    if (s.mode === 'NORMAL' && body.entityType === 'die' && face !== 1 && face !== 5) return;
    isDragging.current = true;
    store.getState().clearChain();
    store.getState().addToChain(bodyId, face);
  }, []);

  const extendChain = useCallback((bodyId: string, face: number, column: number) => {
    if (!isDragging.current) return;
    const s = store.getState();
    if (s.gamePhase !== 'playing') return;
    const body = s.bodies.find(b => b.id === bodyId);
    if (!body || !CHAINABLE.has(body.entityType)) return;
    if (body.entityType === 'lock' && body.health > 0) return;

    const { chain, bodies, mode } = s;
    // NORMAL mode: no chain extension — single die only
    if (mode === 'NORMAL') return;
    // FRENZY: unlimited; PRIME: cap at MAX_CHAIN (6 = tray size)
    if (mode !== 'FRENZY' && chain.length >= MAX_CHAIN) return;
    // Backtrack
    if (chain.length >= 2 && chain[chain.length - 2] === bodyId) {
      store.getState().removeLastFromChain();
      return;
    }
    if (chain.includes(bodyId)) return;

    // Adjacency check
    const lastId = chain[chain.length - 1];
    if (lastId) {
      const lastBody = bodies.find(b => b.id === lastId);
      const thisBody = bodies.find(b => b.id === bodyId);
      if (!lastBody || !thisBody) return;
      const colDiff = Math.abs(lastBody.column - column);
      if (colDiff > 1) return;
      if (colDiff === 1 && Math.abs(lastBody.position.y - thisBody.position.y) > 2.0) return;
    }
    store.getState().addToChain(bodyId, face);
  }, []);

  const endChain = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const s = store.getState();
    if (s.gamePhase !== 'playing' || s.chain.length === 0) {
      store.getState().clearChain();
      return;
    }

    const chainIds = [...s.chain];
    const chainBodies = chainIds.map(id => s.bodies.find(b => b.id === id)).filter(Boolean);
    const physics = physicsRef.current;

    // Check if any catalysts are in the chain
    const catalystIds = chainBodies
      .filter(b => b?.entityType === 'catalyst')
      .map(b => b!.id);

    // Resolve effective faces (wild → plurality, mirror → opposite of neighbor)
    const rawFaces = [...s.chainFaces];
    const resolvedFaces = _resolveChainFacesForChain(chainIds, rawFaces, chainBodies, physics);

    // Temporarily set resolved faces for scoring
    const origFaces = s.chainFaces;
    store.setState({ chainFaces: resolvedFaces });
    const result = store.getState().commitChain();
    if (store.getState().chainFaces !== resolvedFaces) {
      // commitChain cleared it; restore nothing
    }

    // Apply multiplier orb ×1.5 bonus
    if (s.multiplierOrbActive && result === 'ok') {
      store.setState(prev => {
        const bonus = Math.round((prev.unbanked - 0) * 0.5); // 50% on top of committed
        return {
          banked: prev.banked + bonus,
          multiplierOrbActive: false,
        };
      });
    }

    // Apply doubler cell ×2 bonus — if any chain body touches an active doubler column
    if (result === 'ok') {
      const now = Date.now();
      const doublerCells = store.getState().doublerCells.filter(d => d.active && d.expiresAt > now);
      const chainColumns = new Set(chainBodies.map(b => b?.column).filter((c): c is number => c !== undefined));
      for (const dc of doublerCells) {
        if (chainColumns.has(dc.column)) {
          const after = store.getState();
          const bankDelta = after.banked - s.banked;
          const unbankedDelta = after.unbanked - s.unbanked;
          store.setState(prev => ({
            banked: prev.banked + Math.max(0, bankDelta),
            unbanked: prev.unbanked + Math.max(0, unbankedDelta),
          }));
          store.getState().consumeDoublerCell(dc.column);
          break;
        }
      }
    }

    // Remove committed bodies from physics
    for (const id of chainIds) physics?.removeBody(id);

    // Catalyst: apply wild boost
    if (catalystIds.length > 0 && result === 'ok') {
      const currentBoost = store.getState().catalystBoostPct;
      const addBoost = Math.min(
        catalystIds.length * CATALYST_WILD_BOOST,
        CATALYST_MAX_BOOST - currentBoost,
      );
      if (addBoost > 0) {
        store.setState({ catalystBoostPct: currentBoost + addBoost });
        physics?.applyWildcardBoost(addBoost);
        // Re-apply spawn weights with new boost
        const mode = store.getState().mode;
        physics?.setSpawnWeights(SPAWN_WEIGHTS[mode]);
      }
    }

    if (result === 'farkle') {
      setTimeout(_checkDeadBoard, 150);
      return;
    }

    // Post-commit side effects
    if (physics) {
      physics.thawAdjacentIce(chainIds);
      physics.damageLockInColumns(chainIds);
    }

    const { banked, unbanked } = store.getState();
    if (banked + unbanked + store.getState().pendingBombScore >= effectiveWinScore) {
      store.setState({ gamePhase: 'win' });
      return;
    }

    setTimeout(_checkDeadBoard, 150);
  }, [physicsRef]);

  // ── Tap handler: sphere, bomb, rainbow bomb, multiplier orb, ghost ──────────

  const tapEntity = useCallback((bodyId: string) => {
    const s = store.getState();
    if (s.gamePhase !== 'playing') return;
    const body = s.bodies.find(b => b.id === bodyId);
    if (!body) return;
    const physics = physicsRef.current;

    switch (body.entityType) {
      case 'sphere': {
        physics?.removeBody(bodyId);
        store.setState(prev => ({ bodies: prev.bodies.filter(b => b.id !== bodyId) }));
        store.getState().addEnergy(8);
        break;
      }

      case 'multiplier_orb': {
        physics?.removeBody(bodyId);
        store.setState(prev => ({
          bodies: prev.bodies.filter(b => b.id !== bodyId),
          multiplierOrbActive: true,
        }));
        store.getState().addEnergy(5);
        break;
      }

      case 'ghost': {
        // Anchor to nearest column → becomes normal chainable die
        physics?.anchorGhost(bodyId);
        // The transform update will happen next physics step
        break;
      }

      case 'bomb': {
        if (!physics) break;
        const result = physics.activateBomb(bodyId);
        store.setState(prev => ({
          bodies: prev.bodies.filter(b => !result.removedIds.includes(b.id)),
          pendingBombScore: prev.pendingBombScore + result.scoreGained,
          banked: prev.banked + result.scoreGained,
        }));
        store.getState().addEnergy(result.energyGained);
        if (result.stoneHits?.length) {
          store.setState(prev => ({ pendingBombScore: prev.pendingBombScore }));
          // bioSteel reward handled by GameScreen via onStoneDestroyed callback
        }
        const { banked } = store.getState();
        if (banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
        break;
      }

      case 'rainbow_bomb': {
        if (!physics) break;
        const result = physics.activateRainbowBomb(bodyId);
        store.setState(prev => ({
          bodies: prev.bodies.filter(b => !result.removedIds.includes(b.id)),
          banked: prev.banked + result.scoreGained,
        }));
        const { banked } = store.getState();
        if (banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
        break;
      }

      default: break;
    }
  }, [physicsRef]);

  // Keep tapSphere as an alias for backward compat with VoxelPileScene
  const tapSphere = tapEntity;

  const bankScore = useCallback(() => {
    const s = store.getState();
    if (s.gamePhase !== 'playing' || s.unbanked === 0) return;
    store.getState().bankScore();
    // Every 3rd bank: spawn a 30s doubler on a random column
    bankCountRef.current += 1;
    if (bankCountRef.current % 3 === 0) {
      const [col] = _randomColumns(1);
      if (col !== undefined) store.getState().spawnDoublerCell(col, 30_000);
    }
    const { banked } = store.getState();
    if (banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
  }, [effectiveWinScore]);

  function _checkDeadBoard() {
    const physics = physicsRef.current;
    if (!physics || !physics.isDeadBoard()) { deadBoardAttemptsRef.current = 0; return; }
    deadBoardAttemptsRef.current += 1;
    if (deadBoardAttemptsRef.current <= 3) {
      physics.reshuffleBoard();
    } else {
      const bodies = store.getState().bodies;
      for (const b of bodies) {
        if (b.entityType === 'die') physics.setDieFace(b.id, 1);
      }
      deadBoardAttemptsRef.current = 0;
    }
  }

  const startGame = useCallback(() => {
    store.getState().resetGame();
    store.setState({ gamePhase: 'playing', energy: 1 * effectiveEnergyMult, mode: 'PRIME' });
    deadBoardAttemptsRef.current = 0;
    bankCountRef.current = 0;
    frenzyDoublerSpawnedRef.current = false;
    const physics = physicsRef.current;
    if (physics) physics.setSpawnWeights(levelDef?.spawnWeights ?? SPAWN_WEIGHTS.PRIME);
  }, [physicsRef, levelDef, effectiveEnergyMult]);

  return { startChain, extendChain, endChain, tapSphere, tapEntity, bankScore, startGame };
}

// ── Face resolution helpers ───────────────────────────────────────────────────

function _resolveChainFaces(faces: number[]): number[] {
  // Simple resolution for score preview (no body context)
  return faces.map((f, i) => {
    if (f === 0) {
      // Wild: use plurality of other faces
      const others = faces.filter((_, j) => j !== i && faces[j] !== 0);
      return _plurality(others) ?? 1;
    }
    return f;
  });
}

function _resolveChainFacesForChain(
  chainIds: string[],
  rawFaces: number[],
  chainBodies: (import('../store/farkleStore.js').FarkleBody | undefined)[],
  physics: VoxelPhysicsSystem | null,
): number[] {
  // First pass: collect non-special faces
  const nonSpecial = rawFaces.filter((f, i) => {
    const b = chainBodies[i];
    return f !== 0 && b?.entityType !== 'mirror';
  });

  return rawFaces.map((f, i) => {
    const body = chainBodies[i];
    if (!body) return f;

    if (body.entityType === 'wild' || f === 0) {
      return _plurality(nonSpecial) ?? 1;
    }

    if (body.entityType === 'mirror' && physics) {
      return physics.resolveMirrorFace(body.id, chainIds, rawFaces);
    }

    return f;
  });
}

function _plurality(faces: number[]): number | undefined {
  if (faces.length === 0) return undefined;
  const counts: Record<number, number> = {};
  for (const f of faces) counts[f] = (counts[f] ?? 0) + 1;
  let best: number | undefined; let bestC = 0;
  for (const [f, c] of Object.entries(counts)) {
    if (c > bestC) { bestC = c; best = Number(f); }
  }
  return best;
}

function _randomColumns(count: number): number[] {
  const all = [0, 1, 2, 3, 4, 5, 6];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, count);
}
