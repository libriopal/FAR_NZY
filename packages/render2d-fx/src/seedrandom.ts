// Vendored (adapted) from https://github.com/jurerotar/ts-seedrandom (MIT
// License, see LICENSES/ts-seedrandom-LICENSE.md) — mulberry32 algorithm
// only, not the full 20-algorithm library, to keep this package's surface
// small. Attribution preserved from the original: "Mulberry32 PRNG by David
// Stafford" (https://gist.github.com/tommyettinger/46a874533244883189143505d203312c).
//
// Used for client-only decorative randomness (particle color variety,
// ambient flourishes, decorative timing jitter) seeded from the server's
// cosmetic `boardSeed` (gameRoom.ts, explicitly commented as "safe to
// reveal") — every client renders the same decorative choices given the
// same boardSeed, closing "not a single difference in player-facing frame
// drop" for cosmetic variation specifically (ADR-024/025). Never used for
// gameplay-relevant randomness — that stays CSPRNG-seeded server-side.

const UINT32_TO_DOUBLE = 2.3283064365386963e-10; // 2^-32

export interface Mulberry32State {
  s: number;
}

export type Mulberry32PRNG = (() => number) & {
  state: () => Mulberry32State;
};

function seedToUint32(seed: string | number): number {
  const s = typeof seed === 'number'
    ? seed
    : [...seed.toString()].reduce((a, c) => a + c.charCodeAt(0), 0);
  return s >>> 0;
}

/** Deterministic mulberry32 PRNG — same seed always produces the same
 * sequence, on every client, regardless of platform/frame timing. */
export function mulberry32(seed: string | number): Mulberry32PRNG {
  let s = seedToUint32(seed);

  const prng: Mulberry32PRNG = (() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) * UINT32_TO_DOUBLE;
  }) as Mulberry32PRNG;

  prng.state = () => ({ s });
  return prng;
}
