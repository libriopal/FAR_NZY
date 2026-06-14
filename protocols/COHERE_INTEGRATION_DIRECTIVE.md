# COHERE INTEGRATION DIRECTIVE
## Authority: Architecture Review — Final Approved Plan
## Target Repository: libriopal/FAR_NZY (core/ submodule)
## Status: APPROVED FOR IMPLEMENTATION
## Schema Version: 1.0

---

## HOW TO USE THIS FILE

This file is a Claude Code directive protocol.
Run it at the root of your FAR_NZY project with:

```bash
claude --permission-mode acceptEdits "$(cat core/protocols/COHERE_INTEGRATION_DIRECTIVE.md)"
```

Or load it as a project document and say: "Execute the COHERE_INTEGRATION_DIRECTIVE."

Claude Code will execute all 10 phases in sequence.
Each phase is self-contained and verifiable before the next begins.
Do not skip phases. Phase ordering is a hard dependency chain.

---

## MANDATORY PRE-FLIGHT (before any file write)

Read these files before doing anything else:

1. `.ff-core-lock` — memorize every path listed. These files are SACRED. You may never modify them under any circumstance. If any phase instruction could be interpreted as touching a sacred file, do not do it and note the conflict in your summary.

2. `apps/server/src/sandbox.ts` — understand the existing `analyzeRTPImpact()` function and its deterministic fallback branch. You will replace the Gemini call but the deterministic fallback must be preserved byte-for-byte.

3. `supabase/functions/generate-quests/index.ts` — understand the existing cache/auth/Deno infrastructure. You will swap the model only. All infrastructure stays.

4. `packages/ai-quests/src/index.ts` — memorize `QuestTheme`, `buildQuestPrompt`, `PlayerProgressContext`. The generated quest shape must match this contract exactly.

5. `packages/economy/src/index.ts` — note `CurrencyType`, `TransactionRequest`, `EconomyBalance`. The economy auditor will reference these types.

6. `packages/compliance/src/index.ts` — note `ComplianceService`, `RESTRICTED_STATES`. The compliance guard will reference these.

7. `apps/server/src/index.ts` — understand existing route registration. You will add new routes following the same pattern.

After reading all seven files, write a one-paragraph confirmation to stdout stating what you found. Then begin Phase 0.

---

## SACRED FILE PROTECTION (absolute — never violate)

These files must never be touched. If any instruction in this directive could be read as requiring a modification to a sacred file, skip that modification and document the conflict:

```
packages/farkle-shared/src/types.ts
packages/farkle-shared/src/index.ts
packages/farkle-engine/src/chainIndex.ts
packages/farkle-engine/src/farkleScorer.ts
packages/farkle-engine/src/farkleScorer.test.ts
packages/farkle-engine/src/csprng.ts
packages/farkle-engine/src/gridUtils.ts
packages/farkle-engine/src/floodFill.ts
packages/farkle-engine/src/monteCarlo.ts
packages/farkle-engine/src/rtpConfig.ts
packages/farkle-engine/src/index.ts
packages/farkle-engine/src/web.ts
apps/web/src/store/farkleStore.ts
apps/web/src/store/gameStore.ts
apps/web/src/hooks/useFarkleGame.ts
apps/server/src/gameRoom.ts
```

The governance and auditor systems READ output from `monteCarlo.ts` and `rtpConfig.ts`. They never import from them directly and never modify them.

---

## ARCHITECTURE INVARIANTS (enforced throughout all phases)

**Call hierarchy (top to bottom — never bypass):**
```
Caller
  → governance/authorization.ts       (is this call type permitted?)
  → governance/complianceGuard.ts     (does it pass compliance rules?)
  → governance/budgetGuard.ts         (does this category have budget?)
  → auditors/{relevant}Auditor.ts     (format prompt, invoke gateway)
  → gateway/aiGateway.ts              (cache → provider → normalize)
  → providers/ProviderRegistry        (route to AIProvider implementation)
  → providers/cohereProvider.ts       (Cohere API call)
  → [response flows back up]
  → governance/policyEngine.ts        (post-response validation)
  → audit/auditExporter.ts            (write embedding-ready artifact)
  → Caller
```

**Governance must remain operational if Cohere is unavailable.**
Governance files must never import from `providers/`, `auditors/`, or `gateway/`.
Auditors import from governance services and gateway.
Gateway imports from providers only.
Dependency arrows point inward only.

**AI may:**
analyze, summarize, recommend, audit, classify, retrieve

**AI may never:**
decide outcomes, modify probabilities, execute gameplay logic, calculate RTP,
determine payouts, generate RNG, influence dice outcomes, issue rewards,
make compliance decisions, execute the gameplay loop

---

## PHASE 0 — LIVE AUDIT

**Output:** `core/protocols/COHERE_AUDIT_REPORT.md`

Scan the following and document findings:

- Current AI provider usage (Gemini in `sandbox.ts`, Anthropic in edge function)
- All existing imports of `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`
- Current `analyzeRTPImpact()` signature and return shape
- Current edge function model (`claude-haiku-4-5-20251001`)
- Sacred file inventory (confirm all paths from `.ff-core-lock` still exist)
- Missing directories that this directive will create
- `apps/server/package.json` deps (confirm zod is absent, cohere-ai is absent)
- `.env.example` current keys

Format the report as markdown with sections: CURRENT STATE, WHAT WILL BE CREATED, WHAT WILL BE MODIFIED, WHAT WILL NEVER BE TOUCHED, RISKS.

Print "PHASE 0 COMPLETE" when done.

---

## PHASE 1 — AI GATEWAY FOUNDATION

**Creates:**
- `apps/server/src/ai/config.ts`
- `apps/server/src/ai/providers/provider.ts`
- `apps/server/src/ai/providers/cohereProvider.ts`
- `apps/server/src/ai/providers/ProviderRegistry.ts`
- `apps/server/src/ai/gateway/aiGateway.ts`
- `apps/server/src/ai/cache/responseCache.ts`
- `apps/server/src/ai/index.ts`

### `apps/server/src/ai/config.ts`

All configuration values must come from `process.env` with typed defaults.
No magic numbers permitted anywhere in the codebase.

```typescript
// apps/server/src/ai/config.ts
// All Cohere AI configuration — sourced from environment variables.
// Never hardcode values here. Add to .env.example for every new key.

export const AI_CONFIG = {
  // Provider
  cohereApiKey:        process.env.COHERE_API_KEY ?? '',
  questModel:          process.env.COHERE_QUEST_MODEL ?? 'command-r7b-12-2024',
  rtpModel:            process.env.COHERE_RTP_MODEL ?? 'command-r-08-2024',

  // Budget ceilings (USD)
  budgetGovernance:    Number(process.env.COHERE_BUDGET_GOVERNANCE ?? 300),
  budgetMonteCarlo:    Number(process.env.COHERE_BUDGET_MONTE_CARLO ?? 250),
  budgetOpportunity:   Number(process.env.COHERE_BUDGET_OPPORTUNITY ?? 150),
  budgetRetrieval:     Number(process.env.COHERE_BUDGET_RETRIEVAL ?? 150),
  budgetQuest:         Number(process.env.COHERE_BUDGET_QUEST ?? 50),

  // Budget thresholds (fraction of ceiling)
  thresholdWarn:       Number(process.env.COHERE_THRESHOLD_WARN ?? 0.75),
  thresholdRestrict:   Number(process.env.COHERE_THRESHOLD_RESTRICT ?? 0.90),
  thresholdShutdown:   Number(process.env.COHERE_THRESHOLD_SHUTDOWN ?? 1.00),

  // Monte Carlo escalation thresholds
  mcEscalationEnabled:    process.env.COHERE_MONTE_CARLO_ESCALATION_ENABLED !== 'false',
  mcRtpDeltaThreshold:    Number(process.env.COHERE_RTP_DELTA_THRESHOLD ?? 0.03),
  mcFarkleMax:            Number(process.env.COHERE_FARKLE_MAX ?? 0.22),
  mcFarkleMin:            Number(process.env.COHERE_FARKLE_MIN ?? 0.08),
  mcConfidenceWidthMax:   Number(process.env.COHERE_CONFIDENCE_WIDTH ?? 0.06),

  // Quest generation
  questBatchMax:       Number(process.env.QUEST_BATCH_MAX ?? 25),

  // Cache
  cacheTtlMs:          Number(process.env.COHERE_CACHE_TTL_MS ?? 3_600_000), // 1 hour
} as const;
```

### `apps/server/src/ai/providers/provider.ts`

```typescript
// Provider abstraction — every AI provider implements this interface.
// Adding Anthropic, Gemini, Ollama, or a local model never requires
// touching gateway code. Implement this interface and register it.

export interface AIRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cached: boolean;
}

export interface AIProvider {
  readonly id: string;
  generate(request: AIRequest): Promise<AIResponse>;
  healthCheck(): Promise<{ available: boolean; latencyMs?: number }>;
}
```

### `apps/server/src/ai/providers/cohereProvider.ts`

Implements `AIProvider` using `cohere-ai` SDK.
Supports `command-r-08-2024` and `command-r7b-12-2024`.
Reads API key from `AI_CONFIG.cohereApiKey`.
Never throws — returns structured error in `AIResponse.text` if call fails, caller handles.

### `apps/server/src/ai/providers/ProviderRegistry.ts`

```typescript
// ProviderRegistry — single gateway point for all AI provider access.
// Extend ProviderId union when adding providers. Never modify gateway code.

import type { AIProvider } from './provider.js';

export type ProviderId = 'cohere';
// Future: | 'anthropic' | 'gemini' | 'ollama' | 'local'

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, AIProvider>();

  register(id: ProviderId, provider: AIProvider): void {
    this.providers.set(id, provider);
  }

  getProvider(id: ProviderId): AIProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider '${id}' not registered. Register it in ai/index.ts.`);
    return p;
  }

  getDefault(): AIProvider {
    return this.getProvider('cohere');
  }
}

// Singleton — initialize once at server startup via ai/index.ts
export const providerRegistry = new ProviderRegistry();
```

### `apps/server/src/ai/gateway/aiGateway.ts`

Transport only. No policy decisions. No budget decisions. No compliance decisions.
Responsibilities: check cache → call `providerRegistry.getDefault()` → record response → return.
Accepts `AIRequest`, returns `AIResponse`.
Uses `responseCache.ts` with SHA-256 hash of prompt as key.

### `apps/server/src/ai/cache/responseCache.ts`

SHA-256 prompt hash as cache key.
TTL from `AI_CONFIG.cacheTtlMs`.
In-memory Map for Phase 1. Interface must support future Redis/persistent backend without callers changing.

### `apps/server/src/ai/index.ts`

Barrel export for all public types and the `providerRegistry` singleton.
Initialize `cohereProvider` and register it in this file so server startup only needs one import.

Print "PHASE 1 COMPLETE" when done.

---

## PHASE 1.5 — GOVERNANCE LAYER

**Creates:**
- `apps/server/src/ai/governance/policyEngine.ts`
- `apps/server/src/ai/governance/authorization.ts`
- `apps/server/src/ai/governance/budgetGuard.ts`
- `apps/server/src/ai/governance/complianceGuard.ts`
- `apps/server/src/ai/governance/governanceSchemas.ts`

**Rule:** Governance files must never import from `providers/`, `auditors/`, or `gateway/`.
Governance is the outermost layer. It only imports from `spend/`, `config.ts`, and engine packages (read-only).

### `governance/policyEngine.ts`

```typescript
// Enforced prohibited AI responsibilities — these must never be relaxed.
// Both pre-call and post-call validation run through this engine.
const PROHIBITED = [
  'rtp_calculation', 'rtp_determination',
  'rng_generation', 'rng_influence',
  'dice_outcome_selection', 'game_outcome_generation',
  'payout_calculation', 'payout_determination',
  'compliance_decision', 'reward_issuance',
  'gameplay_loop_execution',
] as const;

export type ProhibitedResponsibility = typeof PROHIBITED[number];

export class PolicyViolationError extends Error {
  constructor(public readonly responsibility: ProhibitedResponsibility) {
    super(`PolicyViolation: AI may not perform '${responsibility}'`);
  }
}
```

Pre-call: validate that the request type is not in `PROHIBITED`.
Post-call: scan response text for prohibited language patterns. If found, throw `PolicyViolationError` and do not return the response to the caller.

### `governance/authorization.ts`

Defines `AuditCallType`: `'governance' | 'monte-carlo' | 'economy' | 'opportunity' | 'quest'`.
`authorize(callType: AuditCallType): void` — throws if `cohereApiKey` is empty, if the category is shutdown, or if the call type is not recognized.

### `governance/budgetGuard.ts`

Wraps `BudgetManager`. Exposes `checkBudget(category: SpendCategory): BudgetStatus`.
Throws `BudgetExceededError` if category is at shutdown threshold.
Logs warning at 75%, restricts non-governance categories at 90%.

### `governance/complianceGuard.ts`

Reads `RESTRICTED_STATES` from `packages/compliance/src/index.ts` (read-only import).
`checkCompliance(context?: { state?: string }): void` — throws if context includes a restricted state for casino-relevant calls.

### `governance/governanceSchemas.ts`

Zod schemas for governance audit inputs/outputs. Must import Zod (confirm `zod` is in `package.json` — if not, note it for Phase 5 and use plain TypeScript interfaces as fallback).

```typescript
// Input: RTP proposal from Sandbox
export const RTPProposalSchema = z.object({
  patchName:              z.string(),
  patchDescription:       z.string(),
  baselineRTP:            z.number().min(0).max(2),
  simulationResults: z.object({
    avgScore:    z.number(),
    farkleRate:  z.number().min(0).max(1),
    sessionsRun: z.number().int(),
  }),
  spawnWeightAdjustments: z.record(z.string(), z.number()),
});

// Output: Governance audit finding
export const GovernanceAuditResultSchema = z.object({
  analysis:            z.string(),
  recommendations:     z.array(z.string()),
  projectedRTP:        z.number(),
  projectedRTPRange:   z.tuple([z.number(), z.number()]),
  riskLevel:           z.enum(['low', 'medium', 'high']),
  approved:            z.boolean(),
});

export type RTPProposal = z.infer<typeof RTPProposalSchema>;
export type GovernanceAuditResult = z.infer<typeof GovernanceAuditResultSchema>;
```

Print "PHASE 1.5 COMPLETE" when done.

---

## PHASE 1.6 — BUDGET ENFORCEMENT

**Creates:**
- `apps/server/src/ai/spend/spendTracker.ts`
- `apps/server/src/ai/spend/budgetManager.ts`

### `spend/spendTracker.ts`

Reads and writes `COHERE_SPEND_LOG.json` at project root (not in `src/`).
File is gitignored (add to `.gitignore` if not already present).

```typescript
interface SpendRecord {
  category: SpendCategory;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string; // ISO8601
  callId: string;    // nanoid()
}

interface SpendLog {
  totalUsd: number;
  byCategory: Record<SpendCategory, number>;
  records: SpendRecord[];
  lastUpdated: string;
}
```

`recordCall(record: SpendRecord): void` — appends to log, updates totals.
`getSpend(): SpendLog` — reads current log.
`getCategorySpend(category: SpendCategory): number` — returns category subtotal.

### `spend/budgetManager.ts`

```typescript
export enum SpendCategory {
  GOVERNANCE         = 'GOVERNANCE',         // ceiling: $300
  MONTE_CARLO        = 'MONTE_CARLO',        // ceiling: $250
  OPPORTUNITY_ENGINE = 'OPPORTUNITY_ENGINE', // ceiling: $150 (scaffold only at launch)
  RETRIEVAL          = 'RETRIEVAL',          // ceiling: $150 (deferred — $0 at launch)
  QUEST_GENERATION   = 'QUEST_GENERATION',   // ceiling: $50
}

export type BudgetStatus = 'ok' | 'warning' | 'restricted' | 'shutdown';

export class BudgetExceededError extends Error {
  constructor(public readonly category: SpendCategory) {
    super(`Budget category '${category}' has reached its shutdown threshold`);
  }
}
```

`checkBudget(category: SpendCategory): BudgetStatus` — reads `AI_CONFIG` ceilings and `spendTracker` actuals.
`enforceBudget(category: SpendCategory): void` — throws `BudgetExceededError` if shutdown.
`getAllStatus(): Record<SpendCategory, BudgetStatus>` — used by `/api/governance/health` endpoint.

**Isolation rule:** Quest spend is tracked under `QUEST_GENERATION` only.
`opportunityAdvisor.ts` must pass `SpendCategory.OPPORTUNITY_ENGINE`.
No category may borrow from another.

Print "PHASE 1.6 COMPLETE" when done.

---

## PHASE 1.7 — AUDIT EXPORT SYSTEM

**Creates:**
- `apps/server/src/ai/audit/auditTypes.ts`
- `apps/server/src/ai/audit/auditExporter.ts`
- `runs/governance/.gitkeep`

Add `runs/governance/*.json` to `.gitignore` (the directory exists, the JSON files do not ship with source).

### `audit/auditTypes.ts`

```typescript
// Embedding-ready audit record.
// schemaVersion enables future migration detection.
// All fields required. The future Cohere Embed implementation
// operates on this corpus immediately — no migration needed.

export interface GovernanceAuditRecord {
  schemaVersion:   '1.0';             // increment only with a migration plan
  id:              string;            // nanoid()
  timestamp:       string;            // ISO8601
  auditType:       'governance' | 'monte-carlo' | 'economy' | 'opportunity';
  tags:            string[];          // e.g. ['rtp', 'SOLO_CASINO', 'patch-v1.2']
  proposal:        unknown;           // source input verbatim — typed by caller
  analysis:        string;            // AI findings
  recommendations: string[];         // structured list
  riskLevel:       'low' | 'medium' | 'high';
}
```

### `audit/auditExporter.ts`

`export(record: GovernanceAuditRecord): void`
Writes `runs/governance/{record.id}.json` synchronously (small files, acceptable).
Logs the path written to stdout.
Never throws — if write fails, log error and continue (audit export must not crash the server).

Print "PHASE 1.7 COMPLETE" when done.

---

## PHASE 1.8 — OPPORTUNITY ENGINE SCAFFOLDING

**Creates:**
- `apps/server/src/ai/opportunity/opportunitySchemas.ts`
- `apps/server/src/ai/opportunity/opportunityAdvisor.ts`
- `apps/server/src/ai/opportunity/README.md`

**Tier 2 — scaffold only. No Cohere calls at launch.**
Define all interfaces and contracts now. The Opportunity Engine is the
first planned consumer of Tier 3 retrieval. Scaffolding now prevents
architectural refactoring when Tier 3 begins.

### `opportunity/opportunitySchemas.ts`

```typescript
export interface Opportunity {
  id:          string;
  type:        string;
  description: string;
  value:       number;
}

export interface OpportunityRecommendation {
  confidence:     number;          // 0–1
  reasoning:      string[];
  opportunities:  Opportunity[];
}

export interface OpportunityAnalysis {
  playerSegment:   string;
  riskLevel:       'low' | 'medium' | 'high';
  recommendations: string[];
}

// Future input — player state contract for Tier 2 runtime
export interface PlayerOpportunityContext {
  userId:          string;
  sessionCount:    number;
  avgScore:        number;
  lastFarkleRate:  number;
  currencyBalance: { goldCoins: number; sweepsCoins: number };
  recentModes:     string[];
}
```

### `opportunity/opportunityAdvisor.ts`

Stub only. No Cohere invocations at launch.
Documents that all future calls through this advisor must use `SpendCategory.OPPORTUNITY_ENGINE`.

```typescript
// Tier 2 — scaffold only.
// Runtime Cohere integration begins here when Tier 3 retrieval is ready.
//
// IMPORTANT: All calls through this advisor MUST use SpendCategory.OPPORTUNITY_ENGINE.
// This category has an isolated $150 ceiling. It may NOT consume from:
//   GOVERNANCE, MONTE_CARLO, QUEST_GENERATION, or RETRIEVAL budgets.
//
// The Opportunity Engine will be the FIRST consumer of Tier 3 retrieval.
// Once embeddings exist, this stub becomes a retrieval-augmented recommendation engine.

export async function analyzeOpportunities(
  ctx: PlayerOpportunityContext
): Promise<OpportunityRecommendation> {
  // Deterministic default — returns static recommendations until Tier 2 is implemented.
  return {
    confidence: 0,
    reasoning: ['Opportunity Engine is Tier 2 — not yet implemented.'],
    opportunities: [],
  };
}
```

### `opportunity/README.md`

Document:
- Tier 2 status and what "scaffold only" means
- Full intended call chain: PlayerState → governance → gateway → Cohere → recommendation → deterministic engine decides action
- Why AI never directly issues rewards or modifies player balances
- How this system will consume Tier 3 retrieval (governance audit history → embeddings → context injection)
- `SpendCategory.OPPORTUNITY_ENGINE` isolation requirement and enforcement
- What triggers Tier 2 activation (retrieval corpus reaches minimum threshold)

Print "PHASE 1.8 COMPLETE" when done.

---

## PHASE 1.9 — RETRIEVAL TYPE SYSTEM

**Creates:**
- `apps/server/src/ai/retrieval/retrievalTypes.ts`
- `apps/server/src/ai/retrieval/README.md`

**Tier 3 — type contracts only. No embeddings, no API calls, $0 Cohere spend.**
These stable contracts enable embedding implementation without refactoring.

### `retrieval/retrievalTypes.ts`

```typescript
// Stable contracts for Tier 3 embedding implementation.
// These types must not change without a schema migration plan.
// The GovernanceAuditRecord corpus (runs/governance/*.json) is the
// primary data source — it is already embedding-ready on day one.

export interface RetrievalSource {
  id:       string;
  type:     'governance-audit'
          | 'monte-carlo-report'
          | 'adr'
          | 'compliance-report'
          | 'economy-report'
          | 'opportunity-report'
          | 'simulation-report';
  location: string; // file path now; vector DB key in Tier 3
}

export interface AuditDocument {
  id:        string;
  content:   string;
  source:    RetrievalSource;
  createdAt: string;
}

export interface RTPReport {
  id:         string;
  mode:       string;
  targetRTP:  number;
  actualRTP:  number;
  sessions:   number;
  createdAt:  string;
}

export interface GovernanceAudit {
  id:              string;
  auditType:       string;
  riskLevel:       string;
  recommendations: string[];
  createdAt:       string;
}

export interface DesignDecision {
  id:           string;
  title:        string;
  context:      string;
  decision:     string;
  consequences: string;
  createdAt:    string;
}

export interface SimulationAnalysis {
  id:          string;
  mode:        string;
  sessions:    number;
  avgScore:    number;
  farkleRate:  number;
  findings:    string[];
  createdAt:   string;
}
```

### `retrieval/README.md`

Document:
- Tier 3 status
- Planned stack: Cohere Embed + vector storage + retrieval API
- All retrieval source types and their locations
- Why the Opportunity Engine is the planned first consumer
- How `GovernanceAuditRecord.schemaVersion` prevents migration pain
- `SpendCategory.RETRIEVAL` budget isolation ($150 ceiling)

Print "PHASE 1.9 COMPLETE" when done.

---

## PHASE 2 — AUDITOR LAYER + MONTE CARLO ESCALATION

**Creates:**
- `apps/server/src/ai/auditors/governanceAuditor.ts`
- `apps/server/src/ai/auditors/monteCarloAuditor.ts`
- `apps/server/src/ai/auditors/economyAuditor.ts`

Auditors are AI consumers. They sit below governance and above gateway.
Each auditor: validates input via governance, invokes gateway, parses response, exports audit artifact.

### `auditors/governanceAuditor.ts`

Input: `RTPProposal` (from `governanceSchemas.ts`).
Flow:
1. `authorization.authorize('governance')`
2. `complianceGuard.checkCompliance()`
3. `budgetGuard.checkBudget(SpendCategory.GOVERNANCE)`
4. Build prompt from `RTPProposal`
5. `aiGateway.generate(request)`
6. Parse JSON response into `GovernanceAuditResult`
7. `policyEngine` post-validate
8. `spendTracker.recordCall(...)` with `SpendCategory.GOVERNANCE`
9. `auditExporter.export(record)` — writes `runs/governance/{id}.json`
10. Return `GovernanceAuditResult`

Model: `AI_CONFIG.rtpModel` (`command-r-08-2024`).

### `auditors/monteCarloAuditor.ts`

Input: `MonteCarloResult` (define a local interface matching the output shape of `runMonteCarlo()` — do not import the function itself, do not import from sacred files; match the shape: `{ averageScore, farkleRate, normalizer, sessionsRun }`).

**Deterministic escalation gate — runs before any Cohere call:**

```typescript
function shouldEscalate(result: MonteCarloResult, baselineRTP: number): boolean {
  if (!AI_CONFIG.mcEscalationEnabled) return false;
  const projectedRTP = result.averageScore / result.normalizer;
  const rtpDelta = Math.abs(projectedRTP - baselineRTP);
  return (
    rtpDelta > AI_CONFIG.mcRtpDeltaThreshold ||
    result.farkleRate > AI_CONFIG.mcFarkleMax   ||
    result.farkleRate < AI_CONFIG.mcFarkleMin
  );
}
```

If `shouldEscalate` returns false → return a deterministic analysis immediately, $0 Cohere spend, log "DETERMINISTIC_PATH".
If true → proceed through full governance → gateway → Cohere path, log "ESCALATED_PATH".
Expected: 95% of calls take the deterministic path.

Model: `AI_CONFIG.rtpModel`.
Category: `SpendCategory.MONTE_CARLO`.

### `auditors/economyAuditor.ts`

Stub only. No runtime Cohere calls.
Exports `analyzeEconomyDrift(data: unknown): Promise<string>` as a deterministic stub.
Comment documents that future implementation reads `TransactionRecord` patterns from `packages/economy`, routes through governance using `SpendCategory.GOVERNANCE`.

Print "PHASE 2 COMPLETE" when done.

---

## PHASE 3 — SANDBOX COHERE INTEGRATION

**Modifies:** `apps/server/src/sandbox.ts` (surface file — safe to edit)
**Modifies:** `apps/server/src/index.ts` (surface file — safe to edit)

**Critical rule:** The deterministic fallback branch in `analyzeRTPImpact()` must be preserved byte-for-byte. It becomes the non-escalation path. Do not simplify, remove, or refactor it.

### Changes to `sandbox.ts`:

1. Remove the raw `fetch()` call to `generativelanguage.googleapis.com`.
2. Remove the `GEMINI_API_KEY` reference from this file.
3. Replace with: `const analysis = await monteCarloAuditor.analyze(simulationResults, baselineRTP)`.
4. The `monteCarloAuditor` handles the escalation gate internally — `sandbox.ts` does not need to know about it.
5. Update `/health` endpoint:

```typescript
router.get('/health', (_req, res) => {
  const spend = spendTracker.getSpend();
  const budget = budgetManager.getAllStatus();
  res.json({
    ok: true,
    cohereConfigured: !!AI_CONFIG.cohereApiKey,
    spend: spend.byCategory,
    budget,
  });
});
```

### Add governance route to `index.ts`:

```typescript
import { governanceRouter } from './ai/routes/governanceRouter.js';
app.use('/api/governance', governanceRouter);
```

### Create `apps/server/src/ai/routes/governanceRouter.ts`:

```typescript
import { Router } from 'express';
import { governanceAuditor } from '../auditors/governanceAuditor.js';
import { budgetManager } from '../spend/budgetManager.js';
import { spendTracker } from '../spend/spendTracker.js';

const router = Router();

router.post('/audit', async (req, res) => {
  try {
    const result = await governanceAuditor.analyze(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    budgetStatus: budgetManager.getAllStatus(),
    spend: spendTracker.getSpend().byCategory,
  });
});

export { router as governanceRouter };
```

Print "PHASE 3 COMPLETE" when done.

---

## PHASE 4 — QUEST BATCH GENERATION

**Modifies:** `supabase/functions/generate-quests/index.ts`
**Creates:** `apps/server/src/ai/routes/questRouter.ts`

### Edge function modification:

Swap `claude-haiku-4-5-20251001` for `Deno.env.get('COHERE_QUEST_MODEL') ?? 'command-r7b-12-2024'`.

The Cohere API call shape for Deno:
```typescript
const cohereRes = await fetch('https://api.cohere.com/v1/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${Deno.env.get('COHERE_API_KEY')}`,
  },
  body: JSON.stringify({
    model: Deno.env.get('COHERE_QUEST_MODEL') ?? 'command-r7b-12-2024',
    prompt: buildQuestPrompt(levelReached),
    max_tokens: 800,
    temperature: 0.7,
  }),
});
const cohereData = await cohereRes.json();
const rawText: string = cohereData.generations?.[0]?.text ?? '';
```

**Preserve all existing logic unchanged:**
- Supabase auth check
- `player_saves` read
- `quest_cache` upsert
- `CACHE_TTL_MS` (8 hours)
- `_getTemplateQuests()` fallback
- CORS headers

### Designer batch endpoint:

```typescript
// apps/server/src/ai/routes/questRouter.ts
router.post('/batch', async (req, res) => {
  const { count = 10, themes = [] } = req.body as { count?: number; themes?: string[] };
  if (count > AI_CONFIG.questBatchMax) {
    return res.status(400).json({
      error: `count (${count}) exceeds QUEST_BATCH_MAX (${AI_CONFIG.questBatchMax})`,
      max: AI_CONFIG.questBatchMax,
    });
  }
  // Route through governance with SpendCategory.QUEST_GENERATION
  // Generate in batches, return array of QuestTheme-shaped objects
  // Store to quest_cache via Supabase admin client if configured
});
```

Register in `index.ts`: `app.use('/api/quests', questRouter)`.

Print "PHASE 4 COMPLETE" when done.

---

## PHASE 5 — ENVIRONMENT AND DEPENDENCIES

**Modifies:** `.env.example`
**Modifies:** `apps/server/package.json`

### `.env.example` additions (append after existing Anthropic section):

```bash
# ─── Cohere AI ────────────────────────────────────────────────────────────────
# Required for governance audits, Monte Carlo interpretation, quest generation.
# Set on server. Never expose to client.
COHERE_API_KEY=co-your-key-here

# Models (override to test different Cohere models)
COHERE_QUEST_MODEL=command-r7b-12-2024
COHERE_RTP_MODEL=command-r-08-2024

# Budget ceilings per category (USD) — isolated, no cross-category borrowing
COHERE_BUDGET_GOVERNANCE=300
COHERE_BUDGET_MONTE_CARLO=250
COHERE_BUDGET_OPPORTUNITY=150
COHERE_BUDGET_RETRIEVAL=150
COHERE_BUDGET_QUEST=50

# Budget enforcement thresholds (fraction of ceiling: 0.75=warn, 0.90=restrict, 1.00=shutdown)
COHERE_THRESHOLD_WARN=0.75
COHERE_THRESHOLD_RESTRICT=0.90
COHERE_THRESHOLD_SHUTDOWN=1.00

# Monte Carlo AI escalation (set to 'false' to disable — all analysis will be deterministic)
COHERE_MONTE_CARLO_ESCALATION_ENABLED=true
COHERE_RTP_DELTA_THRESHOLD=0.03
COHERE_FARKLE_MAX=0.22
COHERE_FARKLE_MIN=0.08
COHERE_CONFIDENCE_WIDTH=0.06

# Quest batch generation limit (protect against accidental bulk generation)
QUEST_BATCH_MAX=25

# Cache TTL for Cohere responses (ms) — default 1 hour
COHERE_CACHE_TTL_MS=3600000
```

### `apps/server/package.json` changes:

Add to `dependencies`:
- `"cohere-ai": "^7.0.0"`
- `"zod": "^3.22.0"`

Do not run `pnpm install` — document it in Phase 6 summary.

Print "PHASE 5 COMPLETE" when done.

---

## PHASE 6 — IMPLEMENTATION SUMMARY

**Creates:** `core/protocols/COHERE_IMPLEMENTATION_SUMMARY.md`

Include all of the following sections:

### Files Created (full list with one-line description)
### Files Modified (what changed + what was preserved verbatim)
### Sacred Files Status (confirm none in .ff-core-lock were touched)

### Required Activation Commands
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

### Implementation Tier Status
| Tier | Scope | Status |
|------|-------|--------|
| Tier 1 — Launch Critical | Governance infra, budget enforcement, Monte Carlo auditing, Sandbox integration | ✅ Complete |
| Tier 2 — Next Milestone | Opportunity Engine runtime AI calls | Scaffolded — no runtime calls |
| Tier 3 — Future Intelligence | Retrieval, embeddings, audit search | Types + README only |
| Tier 4 — Content Systems | Quest expansion, narrative | Batch endpoint live |

### Success Criteria (verify all 19)
- [ ] Governance separated from auditors
- [ ] AIProvider interface exists in providers/provider.ts
- [ ] CohereProvider implements AIProvider
- [ ] ProviderRegistry exists with ProviderId = 'cohere'
- [ ] QUEST_BATCH_MAX is env-configurable (default 25)
- [ ] RetrievalSource exists in retrievalTypes.ts
- [ ] opportunityAdvisor.ts stub declares SpendCategory.OPPORTUNITY_ENGINE
- [ ] auditExporter writes to runs/governance/
- [ ] runs/governance/.gitkeep exists
- [ ] GovernanceAuditRecord has schemaVersion: '1.0'
- [ ] policyEngine has all 11 prohibited responsibilities
- [ ] SpendCategory has all 5 categories with isolated ceilings
- [ ] COHERE_SPEND_LOG.json is gitignored
- [ ] Gemini fetch() removed from sandbox.ts
- [ ] Deterministic fallback preserved in sandbox.ts
- [ ] Edge function swapped to Cohere R7B
- [ ] All cache/auth/Supabase logic in edge function preserved
- [ ] monteCarlo.ts and rtpConfig.ts unmodified
- [ ] gameRoom.ts, farkleStore.ts, gameStore.ts unmodified

### Risk Register
Document any conflicts found during Phase 0 audit and how they were resolved.

### Remaining Work Items
Document any work deferred, any sacred file conflicts that prevented full implementation, any Phase items that require manual follow-up.

Print "PHASE 6 COMPLETE — DIRECTIVE EXECUTION COMPLETE" when done.

---

## FINAL VERIFICATION

After all phases complete, confirm:

```
Governance operational if Cohere unavailable:    YES / NO
Sacred files in .ff-core-lock unmodified:        YES / NO
Math.random() not used in any new game code:     YES / NO
setInterval not used for cascade or energy tick: YES / NO
framer-motion not imported (use motion/react):   YES / NO
pnpm workspace namespace @match3d/ (not @farkle/): YES / NO
```

If any answer is NO, resolve it before declaring completion.
