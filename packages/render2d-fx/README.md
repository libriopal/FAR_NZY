# @match3d/render2d-fx

Deterministic visual-polish toolkit for the PixiJS 2D board (ADR-024/025 —
2D board-authoritative pivot). All gameplay/scoring truth stays with the
server's grid; nothing in this package feeds `scoreFarkle()` or any
`SUBMIT_CHAIN`/`BOARD_UPDATE` payload.

## Provenance (vendored, not npm-installed, so the determinism story stays auditable)

| File | Source | License |
|---|---|---|
| `src/seedrandom.ts` | Adapted (mulberry32 only) from [`jurerotar/ts-seedrandom`](https://github.com/jurerotar/ts-seedrandom) | MIT — `LICENSES/ts-seedrandom-LICENSE.md` |
| `src/fixedPoint.ts`, `src/sinLutQ16.ts` | Unmodified from [`ShaiSrc/fixed-point`](https://github.com/ShaiSrc/fixed-point) | MIT — `LICENSES/fixed-point-LICENSE` |
| `src/propelPhysics.ts` | Unmodified from [`kevglass/propel-js`](https://github.com/kevglass/propel-js) | MIT — `LICENSES/propel-js-LICENSE` |

## What each is for

- **`mulberry32`** — deterministic client-only decorative randomness (particle
  color variety, ambient flourishes), seeded from the server's cosmetic
  `boardSeed` so every client renders identical decorative choices.
- **`createFixedPoint`** — Q-format fixed-point math for tween/animation
  interpolation (easing toward each `BOARD_UPDATE` snapshot), avoiding
  float-ULP divergence across browsers/platforms. **Not** used for actual
  scoring math — `farkleScorer.ts`/`monteCarlo.ts` stay integer-based by
  existing policy; this is for visual interpolation only.
- **`physics` (propel-js)** — "simple serialisable deterministic 2D physics,"
  used for purely decorative motion (die landing/settle juice, bomb knockback
  particles). Bodies here are cosmetic overlays on top of the server-dictated
  `(row, col)` a cell actually lands in — never a determinant of it.
