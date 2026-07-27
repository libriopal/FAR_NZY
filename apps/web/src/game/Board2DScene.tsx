// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Visual/presentational layer. Safe to modify appearance.
// Do not add game logic here. Do not remove imports from CORE files.
// ─────────────────────────────────────────────────────
//
// ADR-024/025 2D pivot: PixiJS v8 renderer for the server-authoritative grid,
// replacing the archived Rapier3D/Three.js VoxelPileScene. Renders the
// `Cell[][]` it's given directly — one graphic per cell, no independent
// physics simulation, no local randomness feeding anything scoring-relevant.
//
// Uses `pixi.js` directly (not `@pixi/react`, which requires React 19 — this
// app is on React 18; see the session decision to avoid a React major bump
// just for this). Deterministic cosmetic variation (chain-line color pulse)
// is seeded from `boardSeed` via @match3d/render2d-fx's mulberry32 so every
// client renders the same decorative choice given the same seed.

import { useCallback, useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Cell, GridPos } from '@match3d/farkle-shared';
import { mulberry32 } from '@match3d/render2d-fx';

// Organic Vegas 1.0 neon pip palette — matches the archived VoxelPileScene's
// FACE_COLOR exactly, for visual continuity across the 2D pivot.
const FACE_COLOR: Record<number, number> = {
  1: 0xff2244,
  2: 0xff7700,
  3: 0xffe000,
  4: 0x00ff66,
  5: 0x00aaff,
  6: 0xcc44ff,
};

const BLOCKER_COLOR: Record<string, number> = {
  STONE: 0x5a5a5a,
  ICE: 0x9be7ff,
  LOCK: 0x8866ff,
};

const SPECIAL_COLOR: Record<string, number> = {
  BOMB_STANDARD: 0x333333,
  BOMB_RAINBOW: 0xffffff,
  SPHERE: 0x33ff99,
  MULTIPLIER_ORB: 0xffcc00,
  CATALYST: 0xff66cc,
};

const CELL_SIZE = 64;
const CELL_GAP = 4;
const BOARD_BG = 0x14141c;

export interface Board2DSceneProps {
  grid: Cell[][] | null;
  /** Cosmetic-only — never scoring-relevant. Seeds decorative variation so
   * every client renders identically for the same game. */
  boardSeed?: number | null;
  onChainStart: (row: number, col: number) => void;
  onChainExtend: (row: number, col: number) => void;
  onChainEnd: () => void;
  onEntityTap: (row: number, col: number) => void;
}

function cellFill(cell: Cell): number {
  if (cell.state === 'EMPTY') return 0x0a0a0f;
  if (cell.state === 'WILD') return 0xffffff;
  if (cell.state === 'MIRROR') return 0xcccccc;
  if (cell.state === 'GHOST_PENDING') return 0x2a2a3a;
  if (cell.state === 'FROZEN') return BLOCKER_COLOR.ICE!;
  if (cell.state === 'LOCKED') return BLOCKER_COLOR.LOCK!;
  if (cell.type === 'STONE') return BLOCKER_COLOR.STONE!;
  if (SPECIAL_COLOR[cell.type] !== undefined) return SPECIAL_COLOR[cell.type]!;
  if (cell.face !== null) return FACE_COLOR[cell.face] ?? 0x888888;
  return 0x222222;
}

function cellLabel(cell: Cell): string {
  if (cell.state === 'WILD') return 'W';
  if (cell.state === 'MIRROR') return 'M';
  if (cell.state === 'GHOST_PENDING') return 'G';
  if (cell.type === 'STONE') return String(cell.health ?? '');
  if (cell.type === 'BOMB_STANDARD') return '\u{1F4A3}';
  if (cell.type === 'BOMB_RAINBOW') return '\u{1F308}';
  if (cell.type === 'SPHERE') return '●';
  if (cell.type === 'MULTIPLIER_ORB') return '×1.5';
  if (cell.type === 'CATALYST') return 'C';
  if (cell.face !== null) return String(cell.face);
  return '';
}

const LABEL_STYLE = new TextStyle({
  fill: 0x0a0a0f,
  fontSize: 22,
  fontWeight: 'bold',
  fontFamily: 'sans-serif',
});

export function Board2DScene({
  grid, boardSeed, onChainStart, onChainExtend, onChainEnd, onEntityTap,
}: Board2DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const boardLayerRef = useRef<Container | null>(null);
  const chainLineRef = useRef<Graphics | null>(null);
  const gridRef = useRef<Cell[][] | null>(null);
  const draggingRef = useRef(false);
  const chainPathRef = useRef<GridPos[]>([]);
  const wasDragRef = useRef(false);
  const rngRef = useRef(mulberry32(boardSeed ?? 0));

  const drawBoard = useCallback(() => {
    const layer = boardLayerRef.current;
    const g = gridRef.current;
    if (!layer || !g) return;
    layer.removeChildren();
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[r]!.length; c++) {
        const cell = g[r]![c]!;
        const x = c * (CELL_SIZE + CELL_GAP);
        const y = r * (CELL_SIZE + CELL_GAP);

        const gfx = new Graphics();
        gfx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 8).fill(cellFill(cell));
        layer.addChild(gfx);

        const label = cellLabel(cell);
        if (label) {
          const text = new Text({ text: label, style: LABEL_STYLE });
          text.anchor.set(0.5);
          text.position.set(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
          layer.addChild(text);
        }
      }
    }
  }, []);

  useEffect(() => { gridRef.current = grid; drawBoard(); }, [grid, drawBoard]);
  useEffect(() => { rngRef.current = mulberry32(boardSeed ?? 0); }, [boardSeed]);

  useEffect(() => {
    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    (async () => {
      const initOptions: Parameters<Application['init']>[0] = { background: BOARD_BG, antialias: true };
      if (containerRef.current) initOptions.resizeTo = containerRef.current;
      await app.init(initOptions);
      if (destroyed || !containerRef.current) { app.destroy(); return; }
      containerRef.current.appendChild(app.canvas);

      const boardLayer = new Container();
      app.stage.addChild(boardLayer);
      boardLayerRef.current = boardLayer;

      const chainLine = new Graphics();
      app.stage.addChild(chainLine);
      chainLineRef.current = chainLine;

      app.canvas.addEventListener('pointerdown', (e) => {
        const pos = _screenToCell(app, e);
        if (!pos) return;
        draggingRef.current = true;
        chainPathRef.current = [pos];
        onChainStart(pos.row, pos.col);
        _drawChainLine(chainLine, chainPathRef.current, rngRef.current);
      });
      app.canvas.addEventListener('pointermove', (e) => {
        if (!draggingRef.current) return;
        const pos = _screenToCell(app, e);
        if (!pos) return;
        const last = chainPathRef.current[chainPathRef.current.length - 1];
        if (last && last.row === pos.row && last.col === pos.col) return;
        chainPathRef.current.push(pos);
        onChainExtend(pos.row, pos.col);
        _drawChainLine(chainLine, chainPathRef.current, rngRef.current);
      });
      const endDrag = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        wasDragRef.current = chainPathRef.current.length > 1;
        chainPathRef.current = [];
        chainLine.clear();
        onChainEnd();
      };
      app.canvas.addEventListener('pointerup', endDrag);
      app.canvas.addEventListener('pointerleave', endDrag);
      app.canvas.addEventListener('click', (e) => {
        // click fires after pointerup, so check the flag captured there —
        // by click-time chainPathRef has already been reset by endDrag.
        if (wasDragRef.current) { wasDragRef.current = false; return; }
        const pos = _screenToCell(app, e);
        if (pos) onEntityTap(pos.row, pos.col);
      });

      drawBoard();
    })();

    return () => {
      destroyed = true;
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

function _screenToCell(app: Application, e: PointerEvent | MouseEvent): GridPos | null {
  const rect = app.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / (CELL_SIZE + CELL_GAP));
  const row = Math.floor(y / (CELL_SIZE + CELL_GAP));
  if (row < 0 || col < 0) return null;
  return { row, col };
}

/** Chain-drag feedback line. Color pulse is cosmetic-only, seeded by
 * boardSeed so every client draws the identical color for the same game —
 * "not a single difference in player-facing frame drop" for decoration. */
function _drawChainLine(gfx: Graphics, path: GridPos[], rng: () => number) {
  gfx.clear();
  if (path.length < 2) return;
  const hue = Math.floor(rng() * 0xffffff);
  gfx.setStrokeStyle({ width: 4, color: hue, alpha: 0.85 });
  const center = (p: GridPos) => ({
    x: p.col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
    y: p.row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
  });
  const first = center(path[0]!);
  gfx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i++) {
    const p = center(path[i]!);
    gfx.lineTo(p.x, p.y);
  }
  gfx.stroke();
}
