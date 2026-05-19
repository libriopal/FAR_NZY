// ═══════════════════════════════════════════════════════════════════════════
// slipstream.ts — A: SLIPSTREAM / RACING GENRE  (L3 Overlay + L4 Wrapper)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   Recomputed in gameRoom.nextTurn() after each turn rotation.
//   flowCap fed into applyFlowMultiplier in processChain.
//
// WHAT THIS MODULE DOES:
//   Dynamic RTP balancer for VS and Heist modes.
//   Players ranked by profile.banked each turn. Position drives two scalars:
//
//     windowFactor: scales the beat GOOD zone in the client UI.
//       leader  (pos=1)    → 0.75 (tighter window → harder GOOD)
//       trailer (pos=last) → 1.50 (wider window  → easier GOOD)
//
//     flowCap: caps the maximum flow multiplier gained from beat accuracy.
//       leader  → 1.60
//       trailer → 2.00
//
//   Spec: "If position-1 RTP exceeds 0.96 in a 1000-match window,
//   the leader window narrows further (75% → 65%)." (deferred: requires
//   live telemetry loop; recalibration handled manually via monteCarlo.ts)
//
// ACTIVE IN: VS_FREE, VS_CASINO, HEIST_FREE, HEIST_CASINO
// INACTIVE IN: SOLO, RALLY (cooperative — no leader penalty)
// ═══════════════════════════════════════════════════════════════════════════

export interface SlipstreamState {
  position: number;      // 1-indexed rank (1 = leader)
  totalPlayers: number;
  windowFactor: number;  // 0.75 (leader) → 1.50 (trailer)
  flowCap: number;       // 1.60 (leader) → 2.00 (trailer)
}

export function computeSlipstream(position: number, totalPlayers: number): SlipstreamState {
  if (totalPlayers <= 1) {
    return { position, totalPlayers, windowFactor: 1.0, flowCap: FLOW_CAP_TRAILER };
  }
  const t = (position - 1) / Math.max(1, totalPlayers - 1); // 0.0 = leader, 1.0 = last
  const windowFactor = +(0.75 + t * 0.75).toFixed(2);   // 0.75 → 1.50
  const flowCap      = +(1.60 + t * 0.40).toFixed(2);   // 1.60 → 2.00
  return { position, totalPlayers, windowFactor, flowCap };
}

export const FLOW_CAP_LEADER  = 1.60;
export const FLOW_CAP_TRAILER = 2.00;
export const WINDOW_FACTOR_LEADER  = 0.75;
export const WINDOW_FACTOR_TRAILER = 1.50;
