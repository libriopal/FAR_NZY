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

// Core scoring + RNG (used by web app and server)
export * from './farkleScorer.js';
export * from './chainIndex.js';
export * from './csprng.js';

// Server-only exports (grid management, simulation calibration)
// Import individually from sub-paths when needed server-side.
export * from './gridUtils.js';
export * from './monteCarlo.js';
export * from './rtpConfig.js';
export * from './floodFill.js';
export * from './skillMetrics.js';
export * from './avatar.js';

// OWC types re-exported so consumers of farkle-engine don't need a direct @match3d/owc dependency
// NOTE: FaceBiasWeights (owc) differs from SpawnWeights (farkle-shared):
//   FaceBiasWeights → { face_1..face_6 }  die face probability adjustments
//   SpawnWeights    → { die, sphere, ice.. } entity spawn weights
export type { OWCInput, OWCOutput, SpawnWeights as FaceBiasWeights } from '@match3d/owc';
