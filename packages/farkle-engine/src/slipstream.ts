// ═══════════════════════════════════════════════════════════════════════════
// slipstream.ts — A: SLIPSTREAM / RACING GENRE  (L3 Overlay + L4 Wrapper)
// ═══════════════════════════════════════════════════════════════════════════
//
// POSITION IN GAME LOOP:
//   Recomputed in gameRoom.nextTurn() after each turn rotation.
//   flowCapQ fed into applyFlowMultiplier in processChain.
//
// WHAT THIS MODULE DOES:
//   Dynamic RTP balancer for VS and Heist modes.
//   Players ranked by profile.banked each turn. Position drives two scalars:
//
//     windowFactorQ: Q×1000 — scales the beat GOOD zone in the client UI.
//       leader  (pos=1)    → 750  (tighter window → harder GOOD)
//       trailer (pos=last) → 1500 (wider window  → easier GOOD)
//
//     flowCapQ: Q×1000 — caps the maximum flow multiplier gained from beat accuracy.
//       leader  → 1600
//       trailer → 2000
//
//   Spec: "If position-1 RTP exceeds 0.96 in a 1000-match window,
//   the leader window narrows further (75% → 65%)." (deferred: requires
//   live telemetry loop; recalibration handled manually via monteCarlo.ts)
//
// ACTIVE IN: VS_FREE, VS_CASINO, HEIST_FREE, HEIST_CASINO
// INACTIVE IN: SOLO, RALLY (cooperative — no leader penalty)
// ═══════════════════════════════════════════════════════════════════════════

export interface SlipstreamState {
  position: number;       // 1-indexed rank (1 = leader)
  totalPlayers: number;
  windowFactorQ: number;  // Q×1000: 750 (leader) → 1500 (trailer)
  flowCapQ: number;       // Q×1000: 1600 (leader) → 2000 (trailer)
}

export function computeSlipstream(position: number, totalPlayers: number): SlipstreamState {
  if (totalPlayers <= 1) {
    return { position, totalPlayers, windowFactorQ: 1000, flowCapQ: FLOW_CAP_TRAILER };
  }
  const t = (position - 1) / Math.max(1, totalPlayers - 1); // 0.0 = leader, 1.0 = last
  const windowFactorQ = 750 + Math.round(t * 750);   // Q×1000: 750 → 1500
  const flowCapQ      = 1600 + Math.round(t * 400);  // Q×1000: 1600 → 2000
  return { position, totalPlayers, windowFactorQ, flowCapQ };
}

export const FLOW_CAP_LEADER  = 1600;  // Q×1000: 1.60×
export const FLOW_CAP_TRAILER = 2000;  // Q×1000: 2.00×
export const WINDOW_FACTOR_LEADER  = 750;   // Q×1000: 0.75×
export const WINDOW_FACTOR_TRAILER = 1500;  // Q×1000: 1.50×
