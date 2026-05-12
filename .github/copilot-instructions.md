Repository quick-reference for Copilot sessions

Build, test, and lint commands

- Install: pnpm install (pnpm v9+, Node 20+ recommended).
- Dev (web): pnpm dev  => runs apps/web dev (via pnpm -C apps/web dev).
- Build (monorepo): pnpm build  => runs pnpm -r build across workspaces.
- Build web only: pnpm build:web (output: apps/web/dist/).
- Typecheck (monorepo): pnpm type-check  => runs tsc across packages with type-check scripts.
- Lint (monorepo): pnpm lint  => delegates to workspace lint scripts (if present).
- Test (monorepo): pnpm test  => runs pnpm -r test across workspaces.
  - Run a single package test: pnpm --filter <package> test
    Example: pnpm --filter @match3d/farkle-engine test
  - Many package tests use node's test runner via tsx. You can run the exact test file directly:
    node --import tsx/esm --test packages/farkle-engine/src/farkleScorer.test.ts
- Android (Capacitor): pnpm android:debug / pnpm android:release / pnpm android:bundle
- Supabase local dev: pnpm supabase:start; push schema: pnpm supabase:push; regen types: pnpm supabase:gen-types

High-level architecture (big picture)

- Monorepo (pnpm workspaces). Packages live under packages/, apps under apps/.
- apps/web: React + TypeScript + Vite + three.js (@react-three/fiber). Primary PWA client.
- apps/server: Express + ws (WebSocket) for multiplayer and matchmaking; uses tsx for dev.
- Shared packages: @match3d/* (game-core, farkle-engine, backend-client, compliance, economy, ai-quests, ads, blockchain, analytics, etc.). Shared logic and types live in packages/ and are consumed by apps via workspace: references.
- Backend platform: Supabase (DB, auth, edge functions). Deployment and local dev use supabase CLI (see DEPLOY.md).
- Native wrappers: Capacitor for Android/iOS builds; android/ contains native project.
- Tests: many packages use Node's built-in test runner with tsx shim; some packages expose single-file test scripts.
- Vision & design: authoritative game vision lives in FARKLE_FRENZY_DESCRIPTION.xml and FARKLEFRENZY.md — read before large design or gameplay changes.

Key conventions and patterns

- Package naming: workspace packages use @match3d/<name>. Use pnpm --filter to run package-scoped scripts.
- TypeScript: tsc is used for type checks (many packages provide a "type-check" script). Use pnpm type-check or pnpm --filter <pkg> type-check.
- Tests: run package tests with pnpm --filter <pkg> test. When debugging a single test file, run node --import tsx/esm --test <path-to-test> to match package.json test commands.
- Server dev: apps/server uses tsx watch ("dev" script). Start the server with pnpm --filter @match3d/server dev or cd into apps/server.
- Supabase: local dev flows are documented in DEPLOY.md (copy .env.example, start local Supabase, push schema, regenerate types). Secrets used for edge functions must be set with supabase secrets set — do NOT commit secrets.
- Build outputs: web dist at apps/web/dist; Android artifacts under android/app/build/outputs.
- Capacitor sync: root scripts call npx cap sync android after building web assets (see "cap:sync").
- CI/monorepo orchestration: root package.json delegates to "pnpm -r <script>" for cross-workspace operations.

Where to look first

- DEPLOY.md and build.md: deployment, prerequisites (Node 20+, pnpm 9+, Android SDK, Java 17, Supabase CLI), and commands for local dev and release builds.
- FARKLE_FRENZY_DESCRIPTION.xml and FARKLEFRENZY.md: authoritative game vision, mechanics, and constraints.
- apps/web/package.json and apps/server/package.json: client and server startup/build scripts.
- packages/*: shared libraries (engine, game-core, ai-quests, blockchain, compliance, etc.).

Existing AI/assistant configs

- .claude/ exists (local Claude settings). Avoid committing local settings and secrets.
- No .github/copilot-instructions.md was present; this file is now the project-level guidance for Copilot sessions.
- If other AI config files are added (CLAUDE.md, AGENTS.md, CONVENTIONS.md, .cursorrules, .windsurfrules, etc.), include their authoritative instructions here.

Quick tips for Copilot sessions (do this up-front)

- Start by reading FARKLE_FRENZY_DESCRIPTION.xml and DEPLOY.md for domain constraints and environment prerequisites.
- To run a focused task, use pnpm --filter <pkg> <script> rather than running the entire monorepo.
- Avoid touching or printing secrets (files like .claude/settings*.json, .env) — they are local-only.

Contact points

- Look at apps/web, apps/server, packages/game-core, packages/farkle-engine and packages/backend-client for the most commonly changed code.

---

If you want, I can: add CI-specific Copilot hints (for GitHub Actions), expand single-package run examples for all packages that define tests/type-check scripts, or include short examples for common refactors. Tell me which to add.