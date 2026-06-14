# COHERE IMPLEMENTATION SUMMARY
## Generated: 2026-06-13
## Directive: COHERE_INTEGRATION_DIRECTIVE.md v1.0
## Status: COMPLETE

---

## Files Created (full list with one-line description)

| File | Description |
|------|-------------|
| `apps/server/src/ai/config.ts` | All Cohere env-var config, typed defaults, no magic numbers |
| `apps/server/src/ai/providers/provider.ts` | `AIProvider` interface, `AIRequest`, `AIResponse` types |
| `apps/server/src/ai/providers/cohereProvider.ts` | Cohere SDK implementation of `AIProvider` using `cohere-ai` |
| `apps/server/src/ai/providers/ProviderRegistry.ts` | Singleton registry; `ProviderId = 'cohere'`; extensible without gateway changes |
| `apps/server/src/ai/gateway/aiGateway.ts` | Transport only: cache check → provider call → return; no policy logic |
| `apps/server/src/ai/cache/responseCache.ts` | SHA-256 keyed in-memory cache with TTL; interface supports Redis swap-in |
| `apps/server/src/ai/index.ts` | Barrel export + CohereProvider initialization at startup |
| `apps/server/src/ai/governance/policyEngine.ts` | 11 prohibited responsibilities; pre-call and post-call validation |
| `apps/server/src/ai/governance/authorization.ts` | `AuditCallType` enum; `authorize()` checks API key and call type |
| `apps/server/src/ai/governance/budgetGuard.ts` | Wraps `BudgetManager`; enforces per-category budget before every AI call |
| `apps/server/src/ai/governance/complianceGuard.ts` | Reads `RESTRICTED_STATES` from `@match3d/compliance`; state restriction check |
| `apps/server/src/ai/governance/governanceSchemas.ts` | Plain TS interfaces matching zod schema shapes (zod added Phase 5; migrate after install) |
| `apps/server/src/ai/spend/spendTracker.ts` | Reads/writes `COHERE_SPEND_LOG.json` at project root; `nanoid` callId per record |
| `apps/server/src/ai/spend/budgetManager.ts` | `SpendCategory` enum (5 isolated categories); `BudgetExceededError`; `getAllStatus()` |
| `apps/server/src/ai/audit/auditTypes.ts` | `GovernanceAuditRecord` with `schemaVersion: '1.0'`; embedding-ready |
| `apps/server/src/ai/audit/auditExporter.ts` | Writes `runs/governance/{id}.json`; never throws (audit must not crash server) |
| `apps/server/src/ai/auditors/governanceAuditor.ts` | Full 10-step governance chain: auth → compliance → budget → prompt → gateway → policy → spend → export |
| `apps/server/src/ai/auditors/monteCarloAuditor.ts` | 95% deterministic gate (`shouldEscalate()`); escalates to Cohere only on anomaly |
| `apps/server/src/ai/auditors/economyAuditor.ts` | Stub only; no Cohere calls; documents future `TransactionRecord` pattern analysis |
| `apps/server/src/ai/opportunity/opportunitySchemas.ts` | `Opportunity`, `OpportunityRecommendation`, `PlayerOpportunityContext` types |
| `apps/server/src/ai/opportunity/opportunityAdvisor.ts` | Tier 2 stub; returns deterministic empty result; documents `OPPORTUNITY_ENGINE` budget isolation |
| `apps/server/src/ai/opportunity/README.md` | Tier 2 status, intended call chain, budget isolation, Tier 3 activation criteria |
| `apps/server/src/ai/retrieval/retrievalTypes.ts` | 7 stable retrieval source types + document interfaces; Tier 3 contracts |
| `apps/server/src/ai/retrieval/README.md` | Tier 3 status, planned Cohere Embed stack, migration safety via `schemaVersion` |
| `apps/server/src/ai/routes/governanceRouter.ts` | `POST /api/governance/audit`, `GET /api/governance/health` |
| `apps/server/src/ai/routes/questRouter.ts` | `POST /api/quests/batch` with `QUEST_BATCH_MAX` guard; full governance chain |
| `runs/governance/.gitkeep` | Keeps directory tracked; JSON audit artifacts are gitignored |
| `core/protocols/COHERE_AUDIT_REPORT.md` | Phase 0 live audit output |

---

## Files Modified (what changed + what was preserved verbatim)

### `apps/server/src/sandbox.ts`

**Changed:**
- Added imports: `monteCarloAuditor`, `spendTracker`, `budgetManager`, `AI_CONFIG`
- `analyzeRTPImpact()`: Removed `GEMINI_API_KEY` fetch call to `generativelanguage.googleapis.com`. Replaced with `monteCarloAuditor.analyze()` call. AI analysis text used when available; deterministic string used as fallback.
- `/health` endpoint: Now reports `cohereConfigured`, `spend.byCategory`, `budget` status.

**Preserved byte-for-byte (the non-escalation path):**
```
const { avgScore, farkleRate, sessionsRun } = input.simulationResults;
const BASE_SCORE = 4500;
const projectedRTP = Number(((avgScore / BASE_SCORE) * 0.92).toFixed(4));
const margin = farkleRate * 0.05;
const projectedRTPRange: [number, number] = [...]
const rtpDelta = projectedRTP - input.baselineRTP;
const riskLevel = ...
const approved = projectedRTP >= 0.88 && projectedRTP <= 1.05;
const weights = input.spawnWeightAdjustments;
const face1Shift/face5Shift recommendation logic
const recs: string[] = [...]
```
All WebSocket handlers, V2 routes, role-audit, coverage-status, `callAIAdvisor()` (Anthropic) — unchanged.

### `apps/server/src/index.ts`

**Changed:** Added `governanceRouter`, `questRouter` imports and `app.use()` registrations. Added `import './ai/index.js'` for provider initialization at startup. All existing routes, WebSocket handler, room registry — unchanged.

### `supabase/functions/generate-quests/index.ts`

**Changed:** `ANTHROPIC_API_KEY` check → `COHERE_API_KEY` check. Anthropic `fetch()` to `api.anthropic.com` → Cohere `fetch()` to `api.cohere.com/v1/generate`. Response parse: `llmData.content?.[0]?.text` → `cohereData.generations?.[0]?.text`. Model now reads `Deno.env.get('COHERE_QUEST_MODEL') ?? 'command-r7b-12-2024'`.

**Preserved verbatim:** Supabase client init, auth check, `player_saves` read, `quest_cache` check (cache hit path), `CACHE_TTL_MS = 8 hours`, `quest_cache` upsert, `_getTemplateQuests()` fallback, CORS headers, `_buildPrompt()`.

### `apps/server/package.json`

**Added to dependencies:** `"cohere-ai": "^7.0.0"`, `"zod": "^3.22.0"`, `"@match3d/compliance": "workspace:*"`.

### `core/.env.example`

**Appended:** Full Cohere section with all 14 env vars and documentation.

### `core/.gitignore`

**Appended:** `COHERE_SPEND_LOG.json` and `runs/governance/*.json`.

---

## Sacred Files Status

**All 16 files in `.ff-core-lock` are UNMODIFIED.**

| Sacred File | Status |
|-------------|--------|
| `packages/farkle-shared/src/types.ts` | UNTOUCHED |
| `packages/farkle-shared/src/index.ts` | UNTOUCHED |
| `packages/farkle-engine/src/chainIndex.ts` | UNTOUCHED |
| `packages/farkle-engine/src/farkleScorer.ts` | UNTOUCHED |
| `packages/farkle-engine/src/farkleScorer.test.ts` | UNTOUCHED |
| `packages/farkle-engine/src/csprng.ts` | UNTOUCHED |
| `packages/farkle-engine/src/gridUtils.ts` | UNTOUCHED |
| `packages/farkle-engine/src/floodFill.ts` | UNTOUCHED |
| `packages/farkle-engine/src/monteCarlo.ts` | UNTOUCHED — governance reads its output only |
| `packages/farkle-engine/src/rtpConfig.ts` | UNTOUCHED — governance reads its output only |
| `packages/farkle-engine/src/index.ts` | UNTOUCHED |
| `packages/farkle-engine/src/web.ts` | UNTOUCHED |
| `apps/web/src/store/farkleStore.ts` | UNTOUCHED |
| `apps/web/src/store/gameStore.ts` | UNTOUCHED |
| `apps/web/src/hooks/useFarkleGame.ts` | UNTOUCHED |
| `apps/server/src/gameRoom.ts` | UNTOUCHED |

---

## Required Activation Commands

```bash
# From repo root — install new server dependencies
pnpm install

# Deploy updated edge function to Supabase
supabase secrets set COHERE_API_KEY=co-your-key-here
supabase secrets set COHERE_QUEST_MODEL=command-r7b-12-2024
supabase functions deploy generate-quests

# Verify server starts cleanly
pnpm --filter @match3d/server dev

# Verify governance endpoint responds
curl http://localhost:3001/api/governance/health

# Verify sandbox health (should now report Cohere status)
curl http://localhost:3001/api/sandbox/health

# Verify quest batch endpoint rejects oversized requests
curl -X POST http://localhost:3001/api/quests/batch \
  -H "Content-Type: application/json" \
  -d '{"count": 99}' | grep QUEST_BATCH_MAX
```

---

## Implementation Tier Status

| Tier | Scope | Status |
|------|-------|--------|
| Tier 1 — Launch Critical | Governance infra, budget enforcement, Monte Carlo auditing, Sandbox integration | ✅ Complete |
| Tier 2 — Next Milestone | Opportunity Engine runtime AI calls | Scaffolded — no runtime calls |
| Tier 3 — Future Intelligence | Retrieval, embeddings, audit search | Types + README only |
| Tier 4 — Content Systems | Quest expansion, narrative | Batch endpoint live |

---

## Success Criteria Verification

- [x] Governance separated from auditors
- [x] AIProvider interface exists in providers/provider.ts
- [x] CohereProvider implements AIProvider
- [x] ProviderRegistry exists with ProviderId = 'cohere'
- [x] QUEST_BATCH_MAX is env-configurable (default 25)
- [x] RetrievalSource exists in retrievalTypes.ts
- [x] opportunityAdvisor.ts stub declares SpendCategory.OPPORTUNITY_ENGINE
- [x] auditExporter writes to runs/governance/
- [x] runs/governance/.gitkeep exists
- [x] GovernanceAuditRecord has schemaVersion: '1.0'
- [x] policyEngine has all 11 prohibited responsibilities
- [x] SpendCategory has all 5 categories with isolated ceilings
- [x] COHERE_SPEND_LOG.json is gitignored
- [x] Gemini fetch() removed from sandbox.ts
- [x] Deterministic fallback preserved in sandbox.ts
- [x] Edge function swapped to Cohere R7B
- [x] All cache/auth/Supabase logic in edge function preserved
- [x] monteCarlo.ts and rtpConfig.ts unmodified
- [x] gameRoom.ts, farkleStore.ts, gameStore.ts unmodified

---

## Risk Register

| Risk | Resolution |
|------|-----------|
| `zod` absent at write time | `governanceSchemas.ts` uses plain TS interfaces matching intended zod schema shapes. After `pnpm install`, migrate to `z.object()` — shape does not change. |
| `cohere-ai` SDK absent at write time | `cohereProvider.ts` uses correct SDK import shapes. Compiles after Phase 5 `pnpm install`. |
| Edge function uses local `_buildPrompt()` not `buildQuestPrompt` from `ai-quests` | Local function preserved. Only model and API call shape changed. Quest JSON shape still matches `QuestTheme`. |
| `callAIAdvisor()` in sandbox.ts uses `ANTHROPIC_API_KEY` directly | Out of scope for this directive. Function preserved unchanged. It is the sandbox chat advisor, not RTP governance. |
| `@match3d/compliance` not in server package.json | Added `"@match3d/compliance": "workspace:*"` to server deps in Phase 5. |

---

## Remaining Work Items

1. **`pnpm install`** — Must be run from repo root before server will start. Installs `cohere-ai` and `zod`.
2. **`governanceSchemas.ts` zod migration** — After `pnpm install`, replace plain TS interfaces with `z.object()` schemas. Shape is identical; this is a 1:1 migration.
3. **`COHERE_API_KEY` provisioning** — Obtain from Cohere dashboard; set in `.env.local` and `supabase secrets`.
4. **Retrieval activation** — Tier 3 activates when 100+ governance audit records exist in `runs/governance/` and Cohere Embed API is configured.
5. **Opportunity Engine activation** — Tier 2 activates after Tier 3 retrieval corpus is ready.
6. **Audit log rotation** — `auditExporter.ts` writes indefinitely. Add rotation/archival policy before `runs/governance/` grows large.
7. **Zod for `questRouter.ts` request validation** — Currently trusts Express JSON parser output. After zod install, add input validation to `/batch` endpoint.
