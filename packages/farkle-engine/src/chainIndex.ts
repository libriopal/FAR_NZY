import type { DieFace } from '@match3d/farkle-shared';

export const CHAIN_INDEX_SIZE = 279936;

export function encode(faces: DieFace[], length: number = faces.length): number {
  let base6 = 0;
  for (let i = 0; i < length; i++) {
    base6 += ((faces[i] ?? 1) - 1) * Math.pow(6, 5 - i);
  }
  return (length - 1) * 46656 + base6;
}

export function decode(index: number): { faces: DieFace[]; length: number } {
  const length = Math.floor(index / 46656) + 1;
  let base6 = index % 46656;
  const faces: DieFace[] = [];
  for (let i = 0; i < length; i++) {
    const power = Math.pow(6, 5 - i);
    const faceVal = Math.floor(base6 / power);
    faces.push((faceVal + 1) as DieFace);
    base6 %= power;
  }
  return { faces, length };
}

function internalScoreFarkle(dice: DieFace[], threeOnesScore: number, singleOneScore: number): number {
  if (dice.length === 0) return 0;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const face of dice) counts[face] = (counts[face] ?? 0) + 1;

  if (dice.length === 6) {
    if (counts.slice(1).every(c => (c ?? 0) === 1)) return 1500;
    if (counts.some(c => c === 6)) return 3000;
    if (counts.filter(c => c === 3).length === 2) return 2500;
    if (counts.filter(c => c === 2).length === 3) return 1500;
    if (counts.some(c => c === 4) && counts.some(c => c === 2)) return 1500;
  }

  let score = 0;
  for (let f = 1; f <= 6; f++) {
    const c = counts[f];
    if (c === 0) continue;
    if (c === 5) score += 2000;
    else if (c === 4) score += 1000;
    else if (c === 3) score += f === 1 ? threeOnesScore : f * 100;
    else if (c === 2) {
      if (f === 1) score += singleOneScore * 2;
      else if (f === 5) score += 50 * 2;
      else return 0;
    } else if (c === 1) {
      if (f === 1) score += singleOneScore;
      else if (f === 5) score += 50;
      else return 0;
    }
  }
  return score;
}

export function buildScoreTable(threeOnesScore: number = 1000, singleOneScore: number = 100): Int32Array {
  const table = new Int32Array(CHAIN_INDEX_SIZE);
  for (let i = 0; i < CHAIN_INDEX_SIZE; i++) {
    const length = Math.floor(i / 46656) + 1;
    const base6 = i % 46656;
    const power = Math.pow(6, 6 - length);
    if (base6 % power !== 0) {
      table[i] = 0;
      continue;
    }
    const { faces } = decode(i);
    table[i] = internalScoreFarkle(faces, threeOnesScore, singleOneScore);
  }
  return table;
}

export function buildValidBitmap(table: Int32Array): Uint8Array {
  const bitmap = new Uint8Array(CHAIN_INDEX_SIZE);
  for (let i = 0; i < CHAIN_INDEX_SIZE; i++) {
    bitmap[i] = (table[i] ?? 0) > 0 ? 1 : 0;
  }
  return bitmap;
}

export function lookupScore(faces: DieFace[], table: Int32Array): number {
  if (faces.length === 0 || faces.length > 6) return 0;
  const index = encode(faces);
  return table[index] || 0;
}
