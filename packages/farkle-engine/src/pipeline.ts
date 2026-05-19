export type TrickMeterLevel = 'COLD' | 'WARM' | 'HOT' | 'FRENZY';

export function getTrickMeterLevel(streak: number): TrickMeterLevel {
  if (streak >= 8) return 'FRENZY';
  if (streak >= 5) return 'HOT';
  if (streak >= 3) return 'WARM';
  return 'COLD';
}

const TRICK_MULTIPLIERS: Record<TrickMeterLevel, number> = {
  COLD: 1.0, WARM: 1.25, HOT: 1.5, FRENZY: 2.0,
};

export function applyTrickMeter(rawScore: number, streak: number, ladderMultiplier: number): number {
  const trickMult = TRICK_MULTIPLIERS[getTrickMeterLevel(streak)];
  return Math.round(rawScore * Math.max(trickMult, ladderMultiplier));
}

export function resolveComboBreaker(
  isFarkle: boolean,
  tokens: number,
): { isFarkle: boolean; tokenConsumed: boolean } {
  if (isFarkle && tokens > 0) return { isFarkle: false, tokenConsumed: true };
  return { isFarkle, tokenConsumed: false };
}

export const TRICK_EARN_THRESHOLD = 500;
export const MAX_TOKENS = 5;
