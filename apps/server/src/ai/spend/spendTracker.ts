import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { SpendCategory } from './budgetManager.js';
import { nanoid } from 'nanoid';

export interface SpendRecord {
  category: SpendCategory;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: string; // ISO8601
  callId: string;    // nanoid()
}

export interface SpendLog {
  totalUsd: number;
  byCategory: Record<string, number>;
  records: SpendRecord[];
  lastUpdated: string;
}

// COHERE_SPEND_LOG.json lives at project root (core/), not in src/
const __dirnameCompat = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = resolve(__dirnameCompat, '../../../../../COHERE_SPEND_LOG.json');

const EMPTY_LOG: SpendLog = {
  totalUsd: 0,
  byCategory: {},
  records: [],
  lastUpdated: new Date().toISOString(),
};

function readLog(): SpendLog {
  try {
    const raw = readFileSync(LOG_PATH, 'utf-8');
    return JSON.parse(raw) as SpendLog;
  } catch {
    return { ...EMPTY_LOG, byCategory: {}, records: [] };
  }
}

function writeLog(log: SpendLog): void {
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

export function recordCall(record: Omit<SpendRecord, 'callId'>): void {
  const log = readLog();
  const entry: SpendRecord = { ...record, callId: nanoid() };
  log.records.push(entry);
  log.totalUsd += entry.estimatedCostUsd;
  log.byCategory[entry.category] = (log.byCategory[entry.category] ?? 0) + entry.estimatedCostUsd;
  log.lastUpdated = new Date().toISOString();
  writeLog(log);
}

export function getSpend(): SpendLog {
  return readLog();
}

export function getCategorySpend(category: SpendCategory): number {
  const log = readLog();
  return log.byCategory[category] ?? 0;
}

export const spendTracker = { recordCall, getSpend, getCategorySpend };
