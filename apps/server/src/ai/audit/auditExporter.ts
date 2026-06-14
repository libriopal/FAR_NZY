import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GovernanceAuditRecord } from './auditTypes.js';

const __dirnameCompat = dirname(fileURLToPath(import.meta.url));
// runs/governance/ at core/ root
const RUNS_DIR = resolve(__dirnameCompat, '../../../../../runs/governance');

export function exportAuditRecord(record: GovernanceAuditRecord): void {
  try {
    mkdirSync(RUNS_DIR, { recursive: true });
    const filePath = resolve(RUNS_DIR, `${record.id}.json`);
    writeFileSync(filePath, JSON.stringify(record, null, 2));
    process.stdout.write(`[auditExporter] wrote ${filePath}\n`);
  } catch (err) {
    process.stderr.write(`[auditExporter] failed to write audit record ${record.id}: ${String(err)}\n`);
  }
}

export const auditExporter = { export: exportAuditRecord };
