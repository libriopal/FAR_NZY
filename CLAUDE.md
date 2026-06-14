# CLAUDE.md — FAR_NZY
## Auto-loaded by Claude Code at every session start.

---

## PROJECT IDENTITY

This is **FAR_NZY** — the core game engine for Match-3 Farkle Frenzy.
It is a submodule of `magentadice-cyancode`.

Package namespace: `@match3d/` (NOT `@farkle/` — verify before any import)
Package manager: pnpm workspaces
Platform: Android/Termux arm64, Node 25.x

---

## SACRED FILES — NEVER MODIFY

Read `.ff-core-lock` immediately. Every path in that file is SACRED.
If any task could require modifying a sacred file, stop and document the conflict.

Key sacred files (not exhaustive — read .ff-core-lock for the full list):
```
packages/farkle-engine/src/farkleScorer.ts
packages/farkle-engine/src/monteCarlo.ts
packages/farkle-engine/src/csprng.ts
apps/web/src/store/farkleStore.ts
apps/web/src/store/gameStore.ts
apps/server/src/gameRoom.ts
```

---

## COHERE GOVERNANCE ARCHITECTURE

This project uses a governance-first AI architecture. Read before touching any AI files.

**Full directive:** `core/protocols/COHERE_INTEGRATION_DIRECTIVE.md`
**Implementation summary (post-run):** `core/protocols/COHERE_IMPLEMENTATION_SUMMARY.md`
**Audit report (post-run):** `core/protocols/COHERE_AUDIT_REPORT.md`

**Key rules:**
- AI never calculates RTP, generates RNG, determines payouts, or executes gameplay
- Governance layer is operational even if Cohere is unavailable
- All budget categories are isolated — no cross-category borrowing
- Monte Carlo analysis is 95% deterministic — Cohere only on anomaly escalation
- Opportunity Engine is Tier 2 scaffold only — no Cohere calls at launch
- Retrieval layer is Tier 3 types only — no embeddings at launch

---

## HARD CONSTRAINTS (never violate)

| Rule | Detail |
|------|--------|
| TypeScript | Strict mode, no any |
| Math.random() | Cosmetic/audio only — never game events |
| setInterval | Never for cascade or energy tick — use RAF/setTimeout |
| motion/react | Not framer-motion |
| nanoid() | Not randomUUID() for IDs |
| sql.js | Not better-sqlite3 (arm64 incompatible) |
| React.StrictMode | Disabled — do not add |
| Imports | @match3d/ aliases — not relative paths to packages/ |
