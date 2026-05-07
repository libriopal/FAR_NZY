import type { Cell, GridPos } from '@match3d/farkle-shared';

export function floodFill(
  grid: Cell[][],
  start: GridPos,
  visited?: Set<string>
): GridPos[] {
  const seen = visited ?? new Set<string>();
  const result: GridPos[] = [];
  const queue: GridPos[] = [start];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const key = `${pos.row},${pos.col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pos);

    const neighbors: GridPos[] = [
      { row: pos.row - 1, col: pos.col },
      { row: pos.row + 1, col: pos.col },
      { row: pos.row, col: pos.col - 1 },
      { row: pos.row, col: pos.col + 1 },
    ];

    for (const n of neighbors) {
      if (
        n.row >= 0 && n.row < grid.length &&
        n.col >= 0 && n.col < grid[0].length &&
        !seen.has(`${n.row},${n.col}`)
      ) {
        queue.push(n);
      }
    }
  }

  return result;
}
