// Adapted, near-verbatim from ~/devos (libriopal/libriopal-devos, private
// repo, same author) — apps/devos-server/src/agents/forestAgent.ts. Copied
// rather than rewritten per the session's "reuse, don't rewrite" direction.
//
// Named `forest-ledger` (not `forest`) deliberately: this repo already has
// `forest/` at the root — a genetic-algorithm fitness simulator for
// evolving game-engine subsystems, an unrelated concept that happens to
// share the name in DevOS. This package is the *decision-ledger* FOREST
// (structured architecture-decision records), not the fitness-sim one.
// Only the store path changed from DevOS's `data/forest-decisions.json`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ForestDecision {
  id: string;
  timestamp: string;
  title: string;
  decision: string;
  alternatives: string;
  rationale: string;
  adrLink?: string;
  sprintId?: string;
  tags: string[];
}

interface ForestStore {
  decisions: ForestDecision[];
}

const DEFAULT_STORE_PATH = new URL('../../../.decisions/decisions.json', import.meta.url).pathname;

function loadStore(storePath: string): ForestStore {
  try {
    return JSON.parse(readFileSync(storePath, 'utf8')) as ForestStore;
  } catch {
    return { decisions: [] };
  }
}

function saveStore(store: ForestStore, storePath: string): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function listDecisions(sprintId?: string, storePath = DEFAULT_STORE_PATH): ForestDecision[] {
  const store = loadStore(storePath);
  if (sprintId) return store.decisions.filter(d => d.sprintId === sprintId);
  return store.decisions;
}

export function addDecision(
  input: Omit<ForestDecision, 'id' | 'timestamp'>,
  storePath = DEFAULT_STORE_PATH,
): ForestDecision {
  const store = loadStore(storePath);
  const decision: ForestDecision = {
    ...input,
    id: `forest_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  store.decisions.unshift(decision);
  saveStore(store, storePath);
  return decision;
}

export function deleteDecision(id: string, storePath = DEFAULT_STORE_PATH): boolean {
  const store = loadStore(storePath);
  const before = store.decisions.length;
  store.decisions = store.decisions.filter(d => d.id !== id);
  if (store.decisions.length === before) return false;
  saveStore(store, storePath);
  return true;
}

export function exportDecisions(sprintId?: string, storePath = DEFAULT_STORE_PATH): string {
  const decisions = listDecisions(sprintId, storePath);
  const lines = decisions.map(d => [
    `## ${d.title}`,
    `**Date:** ${d.timestamp.slice(0, 10)}  **Sprint:** ${d.sprintId ?? 'unset'}  **Tags:** ${d.tags.join(', ')}`,
    '',
    `**Decision:** ${d.decision}`,
    '',
    `**Alternatives considered:** ${d.alternatives}`,
    '',
    `**Rationale:** ${d.rationale}`,
    d.adrLink ? `**ADR:** ${d.adrLink}` : '',
    '',
    '---',
    '',
  ].filter(l => l !== undefined).join('\n'));

  return `# FOREST Decision Log${sprintId ? ` — ${sprintId}` : ''}\n\nGenerated: ${new Date().toISOString()}\n\n${lines.join('\n')}`;
}
