# Opportunity Engine — Tier 2 Scaffold

## Status: SCAFFOLD ONLY — No runtime Cohere calls at launch

This module is a **Tier 2 scaffold**. All types and contracts are defined.
No Cohere API calls are made at launch. The stub returns deterministic empty recommendations.

---

## What "scaffold only" means

- All interfaces and contracts are finalized and stable.
- The `analyzeOpportunities()` function exists but returns deterministic defaults.
- No budget is consumed. No API calls are made.
- Calling code is already wired through governance — just the AI call is missing.

---

## Intended call chain (when Tier 2 activates)

```
PlayerState (from game event or session end)
  → authorization.authorize('opportunity')        — API key + call type check
  → complianceGuard.checkCompliance(ctx)           — state restriction check
  → budgetGuard.enforceBudget(OPPORTUNITY_ENGINE)  — $150 ceiling check
  → opportunityAdvisor.analyzeOpportunities(ctx)   — this file
  → [retrieval layer] fetchAuditContext(ctx)        — Tier 3 retrieval (when ready)
  → aiGateway.generate(request)                    — Cohere command-r7b-12-2024
  → policyEngine.validateResponse(text)            — post-call policy check
  → spendTracker.recordCall(OPPORTUNITY_ENGINE)    — spend recorded
  → auditExporter.export(record)                   — audit artifact written
  → return OpportunityRecommendation to caller
  → [deterministic engine decides action]          — AI never issues rewards directly
```

**Why AI never directly issues rewards or modifies player balances:**
AI recommendations are advisory. The deterministic game engine reads the recommendation
and decides whether to act. No LLM output ever writes directly to economy state.
This invariant is enforced by architecture — the Opportunity Engine returns
`OpportunityRecommendation` which is consumed by server-side decision logic,
not applied directly to player state.

---

## Tier 3 retrieval integration plan

When Tier 3 activates, the Opportunity Engine will be its **first consumer**.

Flow:
1. `GovernanceAuditRecord` corpus in `runs/governance/*.json` becomes embedding source.
2. Cohere Embed converts audit records to vector representations.
3. Vector store (TBD: Supabase pgvector or Pinecone) stores embeddings.
4. On each `analyzeOpportunities()` call, relevant audit history is retrieved by similarity.
5. Retrieved context is injected into the prompt, enabling RAG-augmented recommendations.

The `GovernanceAuditRecord.schemaVersion: '1.0'` field ensures the embedding corpus
can be migrated without re-embedding if the schema changes.

---

## SpendCategory.OPPORTUNITY_ENGINE isolation

All calls through this advisor **MUST** use `SpendCategory.OPPORTUNITY_ENGINE`.
This category has an **isolated $150 ceiling** and may **NOT** consume from:
- `GOVERNANCE` ($300 ceiling)
- `MONTE_CARLO` ($250 ceiling)
- `QUEST_GENERATION` ($50 ceiling)
- `RETRIEVAL` ($150 ceiling)

Category isolation is enforced by `spendTracker.recordCall({ category: SpendCategory.OPPORTUNITY_ENGINE, ... })`.
Any code that calls Cohere on behalf of the Opportunity Engine must pass this category explicitly.

---

## Tier 2 activation criteria

Tier 2 activates when the retrieval corpus reaches a minimum threshold:
- At least 100 `GovernanceAuditRecord` entries in `runs/governance/`.
- Cohere Embed API is configured (`COHERE_API_KEY` set, `RETRIEVAL` budget allocated).
- At least one retrieval test passes against the corpus.

Until these conditions are met, `analyzeOpportunities()` returns the deterministic stub.
