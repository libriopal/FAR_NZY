// ═══════════════════════════════════════════════════════
// FARKLE FRENZY — CORE SACRED FILE
// This file implements game balance, scoring, or fairness logic.
// DO NOT MODIFY without:
//   1. Running all 16 farkleScorer test cases
//   2. Running npx tsc --noEmit (must show 0 errors)
//   3. Explicit developer approval
//   4. Updating DECISIONS_LOCKED_v4.txt if any constant changes
// See .ff-core-lock for full classification manifest.
// ═══════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { buildScoreTable, lookupScore, seededRng } from '@match3d/farkle-engine';
import type { DieFace, LevelDef, GameMode } from '@match3d/farkle-shared';
import { SPAWN_WEIGHTS, CATALYST_WILD_BOOST, CATALYST_MAX_BOOST, GAME_CONSTANTS, HEIST_CONSTANTS } from '@match3d/farkle-shared';
import type { VoxelPhysicsSystem } from '@match3d/game-core';
import { useFarkleStore, MAX_CHAIN, WILD_PRIME_ENERGY, WILD_FRENZY_ENERGY } from '../store/farkleStore.js';
import { useExplosionStore } from '../store/explosionStore.js';
import { useTrayStore } from '../store/trayStore.js';

export const WIN_SCORE = 100_000;

// Module-level seeded RNG — replaces Math.random() for game events (W1 compliance).
// Seeded from 32 bits of crypto entropy so each session is unique.
const _sessionRng = seededRng(
  (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0)
);

// Entities that CAN be included in a drag-chain
const CHAINABLE: Set<string> = new Set(['die', 'wild', 'mirror', 'catalyst', 'lock']);
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
  gameMode?: GameMode,
) {
  const store = useFarkleStore;
  const explosionStore = useExplosionStore;
  const isDragging = useRef(false);
  // Maps bodyId → { column, y } at the time it was added to the chain.
  // Auto-commit only if a chained tile physically leaves its column OR row slot.
  const chainEntrySlotRef = useRef<Record<string, { col: number; y: number }>>({});
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const deadBoardAttemptsRef = useRef(0);
  const bankCountRef = useRef(0);
  const frenzyDoublerSpawnedRef = useRef(false);
  const wildScatterCooldownRef = useRef(false);
  const effectiveWinScore = levelDef?.winScore ?? WIN_SCORE;
  const effectiveEnergyMult = levelDef?.energyMultiplier ?? 1.0;

  // ── Energy RAF tick ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = (now: number) => {
      const deltaMs = now - lastTickRef.current;
      const elapsed = deltaMs / 1000;
      lastTickRef.current = now;
      const { mode, gamePhase, doublerCells } = store.getState();
      if (gamePhase === 'playing') {
        if (mode === 'PRIME') store.getState().addEnergy(5 * elapsed);
        else if (mode === 'FRENZY') {
          const { energy } = store.getState();
          const drainRate = energy < 75 ? 3 : 5; // catchup: slower drain when low
          store.getState().addEnergy(-drainRate * elapsed);
          // C11: energy → 0 auto-banks unbanked and ends round
          if (store.getState().energy <= 0 && store.getState().gamePhase === 'playing') {
            store.getState().bankScore();
            const { banked } = store.getState();
            store.setState({ gamePhase: banked >= effectiveWinScore ? 'win' : 'lose' });
          }
        }
        store.getState().tickDisruptCharge(deltaMs);
        store.getState().tickTimer(deltaMs);
        // C1: heist window expiry → claim vault
        const heistState = store.getState();
        if (heistState.heistActive && heistState.heistExpiresAt !== null && now > heistState.heistExpiresAt) {
          store.getState().claimVault();
        }
        // C2: rally decision timeout → auto-bank
        const rallyState = store.getState();
        if (rallyState.rallyDecisionActive && rallyState.rallyDecisionExpiresAt !== null && now > rallyState.rallyDecisionExpiresAt) {
          store.getState().bankScore();
          store.getState().setRallyDecision(false);
          if (store.getState().banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
        }
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

  // ── C4: Wild Scatter — 3+ wilds on board → FRENZY + face-targeted board clear ─
  useEffect(() => {
    return store.subscribe(
      s => s.bodies,
      (bodies) => {
        if (store.getState().gamePhase !== 'playing') return;
        if (wildScatterCooldownRef.current) return;
        const wilds = bodies.filter(b => b.entityType === 'wild');
        if (wilds.length < 3) return;
        const physics = physicsRef.current;
        if (!physics) return;
        wildScatterCooldownRef.current = true;
        // Each wild picks a random face 1-6 via session RNG
        const scatterFaces = wilds.map(() => Math.ceil(_sessionRng() * 6));
        const destroyed = physics.destroyBodiesByFace(scatterFaces);
        if (destroyed.length > 0) {
          store.setState(prev => ({ bodies: prev.bodies.filter(b => !destroyed.includes(b.id)) }));
        }
        // Force FRENZY (energy to threshold)
        store.getState().addEnergy(150 + 10);
        // 10-second cooldown to prevent re-firing while wilds still on board
        setTimeout(() => { wildScatterCooldownRef.current = false; }, 10_000);
      },
    );
  }, [physicsRef]);

  // ── Chain integrity: auto-commit if a chained tile leaves its column OR row ──
  // Only fires when a tile has physically moved out of its grid slot — NOT on
  // normal physics jitter within the slot. Column is an integer (0-6); Y-slot
  // tolerance is 1.2 units (half a tile height) so settling/bounce doesn't trigger.
  useEffect(() => {
    const COL_TOLERANCE = 0; // column is discrete — any change breaks the chain
    const Y_TOLERANCE = 1.2; // world units; less than one tile height
    return store.subscribe(
      s => s.bodies,
      (bodies) => {
        if (!isDragging.current) return;
        const slots = chainEntrySlotRef.current;
        for (const id of Object.keys(slots)) {
          const entry = slots[id];
          if (!entry) continue;
          const body = bodies.find(b => b.id === id);
          if (!body) {
            // Tile was removed (e.g., destroyed) — commit immediately
            endChain();
            return;
          }
          const colLeft = Math.abs(body.column - entry.col) > COL_TOLERANCE;
          const rowLeft = Math.abs(body.position.y - entry.y) > Y_TOLERANCE;
          if (colLeft || rowLeft) {
            endChain();
            return;
          }
        }
      },
    );
  // endChain is stable (useCallback with ref dep) so safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    chainEntrySlotRef.current = { [bodyId]: { col: body.column, y: body.position.y } };
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
    // Cap at tray empty slots (dynamic) or MAX_CHAIN, whichever is smaller (FRENZY: MAX_CHAIN cap still applies)
    const trayLimit = useTrayStore.getState().getEmptySlotCount();
    const cap = mode === 'FRENZY' ? Math.min(MAX_CHAIN, trayLimit) : Math.min(MAX_CHAIN, trayLimit);
    if (chain.length >= cap) return;
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
    chainEntrySlotRef.current[bodyId] = { col: body.column, y: body.position.y };
    store.getState().addToChain(bodyId, face);
  }, []);

  const endChain = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    chainEntrySlotRef.current = {};

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

    // Wild energy bonus: +WILD_PRIME_ENERGY per wild in PRIME, +WILD_FRENZY_ENERGY per wild in FRENZY (B17/B18)
    if (result === 'ok') {
      const wildCount = chainBodies.filter(b => b?.entityType === 'wild').length;
      if (wildCount > 0) {
        if (s.mode === 'PRIME') store.getState().addEnergy(wildCount * WILD_PRIME_ENERGY);
        else if (s.mode === 'FRENZY') store.getState().addEnergy(wildCount * WILD_FRENZY_ENERGY);
      }
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

    // ARCHIVIST: recover 15% of farkle pool per successful chain (B5)
    if (result === 'ok' && s.rallyRole === 'ARCHIVIST') {
      store.getState().drainFarklePool(GAME_CONSTANTS.ARCHIVIST_PCT);
    }

    // C1: Heist — redirect 70% of chain pts to vault, keep 30% in unbanked
    if (result === 'ok' && (gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO')) {
      store.setState(prev => {
        const earned = prev.unbanked - s.unbanked; // pts added this chain
        if (earned <= 0) return prev;
        const toVault = Math.round(earned * HEIST_CONSTANTS.VAULT_SPLIT);
        return { unbanked: prev.unbanked - toVault, vaultPts: prev.vaultPts + toVault };
      });
    }

    // C2: Rally — after a max-chain, present Continue/Bank/Pass for 3 seconds
    if (result === 'ok' && chainIds.length === MAX_CHAIN && (gameMode === 'RALLY_FREE' || gameMode === 'RALLY_CASINO')) {
      store.getState().setRallyDecision(true, Date.now() + 3000);
    }

    // Remove committed bodies from physics and push to tray for delayed scoring
    const trayIds: string[] = [];
    for (const body of chainBodies) {
      if (!body) continue;
      physics?.removeBody(body.id);
      const trayId = useTrayStore.getState().addToTray(body.entityType, body.face ?? null);
      if (trayId) trayIds.push(trayId);
    }

    // Begin burn animation after a short fall delay, then clear when done
    if (trayIds.length > 0) {
      setTimeout(() => {
        const t = useTrayStore.getState();
        for (const tid of trayIds) t.beginBurn(tid);
      }, 300);
    }

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
        const sphereTrayId = useTrayStore.getState().addToTray('sphere', null);
        if (sphereTrayId) {
          const burnMs = useTrayStore.getState().slots.find(sl => sl.id === sphereTrayId)?.burnDurationMs ?? 2000;
          setTimeout(() => useTrayStore.getState().beginBurn(sphereTrayId), 300);
          setTimeout(() => store.getState().addEnergy(8), 300 + burnMs);
        } else {
          store.getState().addEnergy(8);
        }
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
        const bombBody3d = s.bodies.find(b => b.id === bodyId);
        if (!bombBody3d) break;

        // RAINMAKER: intercept bomb tap — open face picker, detonate after selection
        if (s.rallyRole === 'RAINMAKER') {
          store.getState().setPendingRainmakerBombId(bodyId);
          break;
        }

        // Pre-destroy glow: highlight affected bodies for 100ms before detonation
        const blastCols = [bombBody3d.column - 1, bombBody3d.column, bombBody3d.column + 1];
        const preDestroyIds = s.bodies
          .filter(b => b.id !== bodyId &&
            blastCols.includes(b.column) &&
            Math.abs(b.position.y - bombBody3d.position.y) <= 1.5 &&
            b.entityType !== 'sphere')
          .map(b => b.id);
        explosionStore.getState().setHighlightedIds(preDestroyIds);

        setTimeout(() => {
          explosionStore.getState().setHighlightedIds([]);
          explosionStore.getState().addExplosion({
            x: bombBody3d.position.x, y: bombBody3d.position.y, z: bombBody3d.position.z,
            type: 'bomb',
          });
          const result = physics.activateBomb(bodyId);
          store.setState(prev => ({
            bodies: prev.bodies.filter(b => !result.removedIds.includes(b.id)),
            pendingBombScore: prev.pendingBombScore + result.scoreGained,
            banked: prev.banked + result.scoreGained,
          }));
          store.getState().addEnergy(result.energyGained);
          if (result.stoneHits?.length) {
            // bioSteel reward handled by GameScreen via onStoneDestroyed callback
          }
          // Schedule resnap for pushed spheres
          if (result.pushedSphereIds.length > 0) {
            setTimeout(() => {
              for (const sid of result.pushedSphereIds) physics.resnap(sid);
            }, 750);
          }
          const { banked } = store.getState();
          if (banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
        }, 100);
        break;
      }

      case 'rainbow_bomb': {
        if (!physics) break;
        const rbBody3d = s.bodies.find(b => b.id === bodyId);
        if (!rbBody3d) break;

        // Brief pre-destroy glow handled by explosion effect itself (expand to full board)
        setTimeout(() => {
          explosionStore.getState().addExplosion({
            x: rbBody3d.position.x, y: rbBody3d.position.y, z: rbBody3d.position.z,
            type: 'rainbow_bomb',
          });
          const result = physics.activateRainbowBomb(bodyId);
          store.setState(prev => ({
            bodies: prev.bodies.filter(b => !result.removedIds.includes(b.id)),
            banked: prev.banked + result.scoreGained,
          }));
          const { banked } = store.getState();
          if (banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
        }, 80);
        break;
      }

      default: break;
    }
  }, [physicsRef]);

  // Keep tapSphere as an alias for backward compat with VoxelPileScene
  const tapSphere = tapEntity;

  // Rally Pass: hold unbanked, reset chain. CONDUCTOR gets +1 multiplierStep (B6).
  const passScore = useCallback(() => {
    const s = store.getState();
    if (s.gamePhase !== 'playing') return;
    store.getState().passScore();
    if (s.rallyRole === 'CONDUCTOR') {
      store.setState(prev => ({ multiplierStep: Math.min(prev.multiplierStep + 1, 5) }));
    }
  }, []);

  const bankScore = useCallback(() => {
    const s = store.getState();
    if (s.gamePhase !== 'playing' || s.unbanked === 0) return;
    store.getState().bankScore();
    // Every 3rd bank: spawn 1 doubler cell in a random column
    bankCountRef.current += 1;
    if (bankCountRef.current % 3 === 0) {
      const cols = _randomColumns(1);
      for (const col of cols) store.getState().spawnDoublerCell(col, 30_000);
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
    let timeRemaining: number | null = null;
    if (gameMode === 'HEIST_FREE' || gameMode === 'HEIST_CASINO') timeRemaining = 90;
    else if (gameMode === 'RALLY_FREE' || gameMode === 'RALLY_CASINO') timeRemaining = 180;
    else if (levelDef?.timeLimitSec) timeRemaining = levelDef.timeLimitSec;

    store.setState({
      gamePhase: 'playing', energy: 1 * effectiveEnergyMult, mode: 'PRIME',
      ...(timeRemaining !== null ? { timeRemaining } : {}),
    });
    deadBoardAttemptsRef.current = 0;
    bankCountRef.current = 0;
    frenzyDoublerSpawnedRef.current = false;
    const physics = physicsRef.current;
    if (physics) physics.setSpawnWeights(levelDef?.spawnWeights ?? SPAWN_WEIGHTS.PRIME);
  }, [physicsRef, levelDef, effectiveEnergyMult, gameMode]);

  // RAINMAKER: called by FarkleHUD face picker with the chosen face (1-6)
  const confirmRainmakerBomb = useCallback((face: number) => {
    const s = store.getState();
    const bombId = s.pendingRainmakerBombId;
    if (!bombId || !physicsRef.current) return;
    const physics = physicsRef.current;
    const bombBody3d = s.bodies.find(b => b.id === bombId);
    store.getState().setPendingRainmakerBombId(null);
    store.getState().setRainmakerBombFace(null);
    if (!bombBody3d) return;
    explosionStore.getState().addExplosion({
      x: bombBody3d.position.x, y: bombBody3d.position.y, z: bombBody3d.position.z,
      type: 'bomb',
    });
    // Activate as face-targeted bomb (RAINMAKER color selection)
    const result = physics.activateBomb(bombId, face);
    store.setState(prev => ({
      bodies: prev.bodies.filter(b => !result.removedIds.includes(b.id)),
      banked: prev.banked + result.scoreGained,
      pendingBombScore: prev.pendingBombScore + result.scoreGained,
    }));
    store.getState().addEnergy(result.energyGained);
    setTimeout(_checkDeadBoard, 150);
  }, [physicsRef]);

  // C1: Heist — initiate vault heist (costs HEIST_ENERGY_COST energy)
  const initiateHeist = useCallback(() => {
    const s = store.getState();
    if (s.gamePhase !== 'playing') return;
    if (s.heistActive) return;
    if (s.vaultPts < HEIST_CONSTANTS.VAULT_THRESHOLD) return;
    if (s.energy < HEIST_CONSTANTS.HEIST_ENERGY_COST) return;
    store.getState().addEnergy(-HEIST_CONSTANTS.HEIST_ENERGY_COST);
    store.getState().setHeistActive('local', Date.now() + HEIST_CONSTANTS.HEIST_WINDOW_MS);
  }, []);

  // C1: Heist — block an active heist (available to all players; single-player: self-block cancels)
  const blockHeist = useCallback(() => {
    const s = store.getState();
    if (!s.heistActive) return;
    store.getState().cancelHeist();
  }, []);

  // C2: Rally — manual bank during decision window
  const rallyBank = useCallback(() => {
    const s = store.getState();
    if (!s.rallyDecisionActive) return;
    store.getState().bankScore();
    store.getState().setRallyDecision(false);
    if (store.getState().banked >= effectiveWinScore) store.setState({ gamePhase: 'win' });
  }, [effectiveWinScore]);

  // C2: Rally — pass turn during decision window; CONDUCTOR gets +1 multiplier step
  const rallyPass = useCallback(() => {
    const s = store.getState();
    if (!s.rallyDecisionActive) return;
    if (s.rallyRole === 'CONDUCTOR') {
      store.setState(prev => ({ multiplierStep: Math.min(prev.multiplierStep + 1, 5) }));
    }
    store.getState().passScore();
    store.getState().setRallyDecision(false);
  }, []);

  // C15: Rally — continue rolling (solo: dismiss panel; multiplayer: server decides)
  const rallyContinue = useCallback(() => {
    const s = store.getState();
    if (!s.rallyDecisionActive) return;
    store.getState().setRallyDecision(false);
  }, []);

  return { startChain, extendChain, endChain, tapSphere, tapEntity, bankScore, passScore, startGame, confirmRainmakerBomb, initiateHeist, blockHeist, rallyBank, rallyPass, rallyContinue };
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
    const j = Math.floor(_sessionRng() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all.slice(0, count);
}
