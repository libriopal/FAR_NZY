# Retrieval Layer — Tier 3

## Status: TYPE CONTRACTS ONLY — No embeddings, no API calls, $0 Cohere spend

This module defines stable type contracts for the future Tier 3 embedding implementation.
No Cohere API calls are made. No embeddings are generated. No vector storage is configured.

---

## Planned stack

```
GovernanceAuditRecord corpus (runs/governance/*.json)
  → Cohere Embed v3 (text-to-vector)
  → Vector store (Supabase pgvector or Pinecone)
  → Retrieval API (similarity search by embedding)
  → Context injection into AI prompts (RAG)
```

---

## Retrieval source types

| Type | Location at launch | Description |
|------|--------------------|-------------|
| `governance-audit` | `runs/governance/*.json` | RTP and governance audit records |
| `monte-carlo-report` | `art/profiling/*.json` | Monte Carlo simulation output |
| `adr` | `docs/adr/*.md` | Architecture decision records |
| `compliance-report` | (future) | Compliance audit snapshots |
| `economy-report` | (future) | Economy drift analysis |
| `opportunity-report` | (future) | Opportunity Engine recommendation history |
| `simulation-report` | (future) | Extended simulation analysis artifacts |

---

## Why the Opportunity Engine is the first planned consumer

The Opportunity Engine (Tier 2) needs historical governance audit context to make
useful player-facing recommendations. The governance audit corpus in `runs/governance/`
is the natural first embedding target because:

1. It accumulates continuously from every governance and Monte Carlo auditor call.
2. Each record is already embedding-ready (`GovernanceAuditRecord` with all required fields).
3. The Opportunity Engine prompt quality is directly proportional to retrieval context quality.

---

## schemaVersion and migration safety

`GovernanceAuditRecord.schemaVersion: '1.0'` is present in every audit record.
If the schema changes:
1. Bump `schemaVersion` in `auditTypes.ts`.
2. Write a migration script that re-embeds records with the old schema version.
3. Do NOT re-embed records that already match the new schema.

This prevents silent schema drift from poisoning the embedding corpus.

---

## SpendCategory.RETRIEVAL budget isolation

All embedding and retrieval API calls must use `SpendCategory.RETRIEVAL`.
This category has an **isolated $150 ceiling** and may **NOT** consume from:
- `GOVERNANCE`, `MONTE_CARLO`, `OPPORTUNITY_ENGINE`, or `QUEST_GENERATION` budgets.

At launch, `RETRIEVAL` spends $0. The ceiling is pre-configured in `.env.example`
so activation only requires obtaining a Cohere API key with Embed access.
