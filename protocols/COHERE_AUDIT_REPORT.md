# COHERE AUDIT REPORT
## Generated: 2026-06-13
## Status: Pre-implementation live audit — Phase 0 of COHERE_INTEGRATION_DIRECTIVE

---

## CURRENT STATE

### AI Provider Usage

| File | Provider | Key Used | Purpose |
|------|----------|----------|---------|
| `apps/server/src/sandbox.ts` | Google Gemini | `GEMINI_API_KEY` | `analyzeRTPImpact()` — RTP governance analysis |
| `apps/server/src/sandbox.ts` | Anthropic | `ANTHROPIC_API_KEY` | `callAIAdvisor()` — sandbox chat advisor (KEEP — not in scope for this directive) |
| `supabase/functions/generate-quests/index.ts` | Anthropic | `ANTHROPIC_API_KEY` | Quest generation — model `claude-haiku-4-5-20251001` |

### `analyzeRTPImpact()` Signature and Return Shape

**Location:** `apps/server/src/sandbox.ts:63–152`

**Input:**
```typescript
{
  patchName: string;
  patchDescription: string;
  baselineRTP: number;
  simulationResults: { avgScore: number; farkleRate: number; sessionsRun: number };
  spawnWeightAdjustments: Record<string, number>;
}
```

**Return:**
```typescript
{
  analysis: string;
  recommendations: string[];
  projectedRTP: number;
  projectedRTPRange: [number, number];
  riskLevel: 'low' | 'medium' | 'high';
  approved: boolean;
}
```

**Deterministic fallback logic (lines 119–152):** Uses `BASE_SCORE = 4500`, `projectedRTP = (avgScore / BASE_SCORE) * 0.92`, margin `= farkleRate * 0.05`, riskLevel thresholds `<0.02 low / <0.05 medium / else high`, approved band `[0.88, 1.05]`. This block **must be preserved byte-for-byte.**

### Edge Function Current Model

`supabase/functions/generate-quests/index.ts` — line 73: `model: 'claude-haiku-4-5-20251001'`

### Sacred File Inventory

All 16 files in `.ff-core-lock` confirmed present on disk:

| File | Status |
|------|--------|
| `packages/farkle-shared/src/types.ts` | EXISTS |
| `packages/farkle-shared/src/index.ts` | EXISTS |
| `packages/farkle-engine/src/chainIndex.ts` | EXISTS |
| `packages/farkle-engine/src/farkleScorer.ts` | EXISTS |
| `packages/farkle-engine/src/farkleScorer.test.ts` | EXISTS |
| `packages/farkle-engine/src/csprng.ts` | EXISTS |
| `packages/farkle-engine/src/gridUtils.ts` | EXISTS |
| `packages/farkle-engine/src/floodFill.ts` | EXISTS |
| `packages/farkle-engine/src/monteCarlo.ts` | EXISTS |
| `packages/farkle-engine/src/rtpConfig.ts` | EXISTS |
| `packages/farkle-engine/src/index.ts` | EXISTS |
| `packages/farkle-engine/src/web.ts` | EXISTS |
| `apps/web/src/store/farkleStore.ts` | EXISTS |
| `apps/web/src/store/gameStore.ts` | EXISTS |
| `apps/web/src/hooks/useFarkleGame.ts` | EXISTS |
| `apps/server/src/gameRoom.ts` | EXISTS |

### Missing Directories (will be created by this directive)

```
apps/server/src/ai/
apps/server/src/ai/config.ts
apps/server/src/ai/providers/
apps/server/src/ai/gateway/
apps/server/src/ai/cache/
apps/server/src/ai/governance/
apps/server/src/ai/spend/
apps/server/src/ai/audit/
apps/server/src/ai/auditors/
apps/server/src/ai/opportunity/
apps/server/src/ai/retrieval/
apps/server/src/ai/routes/
runs/governance/
```

### Package Dependencies Status

**`apps/server/package.json`:**
- `cohere-ai`: **ABSENT** (will be added in Phase 5)
- `zod`: **ABSENT** (will be added in Phase 5; govSchema.ts will use plain TS as fallback until installed)

### `.env.example` Current Keys

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_WS_URL
VITE_APPLOVIN_SDK_KEY
VITE_APPLOVIN_REWARDED_AD_UNIT
VITE_APPLOVIN_INTERSTITIAL_AD_UNIT
ANTHROPIC_API_KEY (commented)
ALCHEMY_API_KEY (commented)
RELAY_WALLET_PRIVATE_KEY (commented)
```

No `GEMINI_API_KEY` in `.env.example` (it was used directly from runtime env without documentation).

---

## WHAT WILL BE CREATED

| Path | Purpose |
|------|---------|
| `apps/server/src/ai/config.ts` | All Cohere env-var config, typed, no magic numbers |
| `apps/server/src/ai/providers/provider.ts` | `AIProvider` interface, `AIRequest`, `AIResponse` |
| `apps/server/src/ai/providers/cohereProvider.ts` | Cohere SDK implementation of `AIProvider` |
| `apps/server/src/ai/providers/ProviderRegistry.ts` | Singleton registry; `ProviderId = 'cohere'` |
| `apps/server/src/ai/gateway/aiGateway.ts` | Transport only: cache → provider → return |
| `apps/server/src/ai/cache/responseCache.ts` | SHA-256 keyed in-memory cache with TTL |
| `apps/server/src/ai/index.ts` | Barrel export + provider initialization |
| `apps/server/src/ai/governance/policyEngine.ts` | 11 prohibited responsibilities, pre/post validation |
| `apps/server/src/ai/governance/authorization.ts` | `AuditCallType`, `authorize()`, API key check |
| `apps/server/src/ai/governance/budgetGuard.ts` | Wraps `BudgetManager`, enforces category budget |
| `apps/server/src/ai/governance/complianceGuard.ts` | Reads `RESTRICTED_STATES`, state check |
| `apps/server/src/ai/governance/governanceSchemas.ts` | Zod schemas (TS interfaces as fallback until zod installed) |
| `apps/server/src/ai/spend/spendTracker.ts` | Reads/writes `COHERE_SPEND_LOG.json` |
| `apps/server/src/ai/spend/budgetManager.ts` | `SpendCategory` enum, `BudgetStatus`, enforcement |
| `apps/server/src/ai/audit/auditTypes.ts` | `GovernanceAuditRecord` with `schemaVersion: '1.0'` |
| `apps/server/src/ai/audit/auditExporter.ts` | Writes `runs/governance/{id}.json` |
| `apps/server/src/ai/opportunity/opportunitySchemas.ts` | `Opportunity`, `OpportunityRecommendation`, `PlayerOpportunityContext` |
| `apps/server/src/ai/opportunity/opportunityAdvisor.ts` | Tier 2 stub, no runtime Cohere calls |
| `apps/server/src/ai/opportunity/README.md` | Documents Tier 2 status, call chain, budget isolation |
| `apps/server/src/ai/retrieval/retrievalTypes.ts` | `RetrievalSource`, `AuditDocument`, `RTPReport`, etc. |
| `apps/server/src/ai/retrieval/README.md` | Documents Tier 3 status, planned stack |
| `apps/server/src/ai/auditors/governanceAuditor.ts` | Full governance chain: auth → compliance → budget → gateway → export |
| `apps/server/src/ai/auditors/monteCarloAuditor.ts` | 95% deterministic gate, escalates to Cohere on anomaly |
| `apps/server/src/ai/auditors/economyAuditor.ts` | Stub, no Cohere calls |
| `apps/server/src/ai/routes/governanceRouter.ts` | `POST /audit`, `GET /health` |
| `apps/server/src/ai/routes/questRouter.ts` | `POST /batch` with `QUEST_BATCH_MAX` guard |
| `runs/governance/.gitkeep` | Keep directory in source |
| `core/protocols/COHERE_IMPLEMENTATION_SUMMARY.md` | Post-run summary (Phase 6) |

---

## WHAT WILL BE MODIFIED

| File | Change | Preserved |
|------|--------|-----------|
| `apps/server/src/sandbox.ts` | Remove `GEMINI_API_KEY` fetch, replace with `monteCarloAuditor.analyze()`, update `/health` endpoint | Deterministic fallback (lines 119–152), all other routes, WebSocket handler, `callAIAdvisor()` (Anthropic) |
| `apps/server/src/index.ts` | Add `governanceRouter` and `questRouter` imports + `app.use()` | All existing routes, WebSocket, room registry |
| `supabase/functions/generate-quests/index.ts` | Swap Anthropic model to `Deno.env.get('COHERE_QUEST_MODEL') ?? 'command-r7b-12-2024'`, update API call shape | Auth, `player_saves` read, `quest_cache` upsert, `CACHE_TTL_MS`, `_getTemplateQuests()`, CORS headers |
| `apps/server/package.json` | Add `cohere-ai: ^7.0.0` and `zod: ^3.22.0` to dependencies | All existing deps |
| `.env.example` | Append Cohere section after Anthropic section | All existing entries |
| `.gitignore` | Add `COHERE_SPEND_LOG.json` and `runs/governance/*.json` | All existing entries |

---

## WHAT WILL NEVER BE TOUCHED

All 16 files in `.ff-core-lock`:
- `packages/farkle-shared/src/types.ts`
- `packages/farkle-shared/src/index.ts`
- `packages/farkle-engine/src/chainIndex.ts`
- `packages/farkle-engine/src/farkleScorer.ts`
- `packages/farkle-engine/src/farkleScorer.test.ts`
- `packages/farkle-engine/src/csprng.ts`
- `packages/farkle-engine/src/gridUtils.ts`
- `packages/farkle-engine/src/floodFill.ts`
- `packages/farkle-engine/src/monteCarlo.ts` ← governance reads output only, never imports
- `packages/farkle-engine/src/rtpConfig.ts` ← governance reads output only, never imports
- `packages/farkle-engine/src/index.ts`
- `packages/farkle-engine/src/web.ts`
- `apps/web/src/store/farkleStore.ts`
- `apps/web/src/store/gameStore.ts`
- `apps/web/src/hooks/useFarkleGame.ts`
- `apps/server/src/gameRoom.ts`

---

## RISKS

| Risk | Mitigation |
|------|-----------|
| `zod` not installed when `governanceSchemas.ts` is written | Using plain TS interfaces as structural equivalents; Phase 5 adds `zod` to package.json; schemas will be updated to use `z.object()` after `pnpm install` |
| `cohere-ai` SDK not installed at write time | `cohereProvider.ts` written with correct SDK import shapes; will compile once Phase 5 `pnpm install` runs |
| Edge function calling `_buildPrompt(levelReached)` not `buildQuestPrompt` from `ai-quests` package | Local function retained; only the model/API shape changes. Contract still matches `QuestTheme` shape. |
| `callAIAdvisor()` in sandbox.ts uses `ANTHROPIC_API_KEY` directly | This function is NOT in scope for this directive. It will be preserved as-is. |
| `GEMINI_API_KEY` not in `.env.example` | After Phase 3, key is no longer used for RTP analysis. `.env.example` note added to remove it from deployments. |
| `runs/governance/*.json` files could grow large | Gitignored; only `.gitkeep` tracked. Size managed by `auditExporter.ts` logging (no auto-rotation in Phase 1 — noted for future work). |
