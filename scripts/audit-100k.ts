// 100k compliance audit for P6-PLAYERMODEL-FIX (ADR-022).
// Produces art/profiling/rtp_audit_P6_42.json in the existing format.

import { runMonteCarloV2 } from '@match3d/farkle-engine/monteCarlo';
import type { SimConfig } from '@match3d/farkle-engine/monteCarlo';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirnameCompat = dirname(fileURLToPath(import.meta.url));
const SEED     = 42;
const SESSIONS = 100_000;
const SPRINT   = 'P6-PLAYERMODEL-FIX';

const modes  = ['SOLO_CASINO', 'VS_CASINO', 'RALLY_CASINO'] as const;
const models = ['OPTIMAL', 'AVERAGE', 'WEAK'] as const;

async function main() {
  console.log(`P6 compliance audit: seed=${SEED}, sessions=${SESSIONS} per config (${modes.length * models.length} configs)\n`);

  const results: Record<string, Awaited<ReturnType<typeof runMonteCarloV2>>> = {};

  for (const m of modes) {
    for (const p of models) {
      process.stdout.write(`  ${m}/${p}... `);
      const config: SimConfig = {
        mode:           m,
        sessions:       SESSIONS,
        maxTurns:       30,
        playerModel:    p,
        blockerDensity: 'MEDIUM',
        playerCount:    m === 'SOLO_CASINO' ? 1 : 4,
        seed:           SEED,
        owcEnabled:     false,
        stakeAmount:    1,
      };
      results[`${m}_${p}`] = await runMonteCarloV2(config);
      console.log(`avgScore=${results[`${m}_${p}`]!.averageScore} farkleRate=${results[`${m}_${p}`]!.farkleRate.toFixed(4)}`);
    }
  }

  const soloOpt  = results['SOLO_CASINO_OPTIMAL']!;
  const soloAvg  = results['SOLO_CASINO_AVERAGE']!;
  const soloWeak = results['SOLO_CASINO_WEAK']!;

  const soloRTP        = Number((soloAvg.averageScore / soloAvg.normalizer).toFixed(4));
  const properOrdering = soloOpt.averageScore > soloAvg.averageScore &&
                         soloAvg.averageScore > soloWeak.averageScore;
  const skillGapRaw    = Math.round(soloOpt.averageScore - soloWeak.averageScore);
  const skillGapNorm   = Number((Math.abs(skillGapRaw) / soloWeak.averageScore).toFixed(4));

  const gates = {
    Gate1: { pass: soloOpt.sessionsRun >= 1,                                 value: soloOpt.sessionsRun,  threshold: '≥1' },
    Gate2: { pass: soloRTP >= 0.82 && soloRTP <= 1.02,                        value: soloRTP,              threshold: '0.82–1.02' },
    Gate3: { pass: properOrdering, value: `${soloOpt.averageScore}>${soloAvg.averageScore}>${soloWeak.averageScore}`, normalized: skillGapNorm, threshold: 'OPTIMAL>AVERAGE>WEAK (ADR-022 Option A)' },
    Gate4: { pass: soloOpt.farkleRate >= 0.85 && soloOpt.farkleRate <= 0.95,  value: soloOpt.farkleRate,   threshold: '0.85–0.95' },
    Gate5: { pass: soloOpt.p5Score >= 0 && soloAvg.averageScore > 100,        value: soloOpt.p5Score,      threshold: 'p5≥0, avg>100' },
    Gate6: { pass: soloOpt.normalizer > 0,                                     value: soloOpt.normalizer,   threshold: '>0' },
  };

  const allPass = Object.values(gates).every(g => g.pass);

  console.log('\n─── Gate Results ──────────────────────────────────────────────');
  for (const [name, g] of Object.entries(gates)) {
    console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${name}  ${g.value}  [${g.threshold}]`);
  }
  console.log('─────────────────────────────────────────────────────────────');
  console.log(allPass ? '\nAll 6 gates PASS ✓' : '\nSome gates FAILED ✗');

  const artifact = {
    auditId:      'rtp_audit_P6_42',
    date:         new Date().toISOString().slice(0, 10),
    sprint:       SPRINT,
    seed:         SEED,
    sessions:     SESSIONS,
    stakeAmount:  1,
    owcEnabled:   false,
    gateRevision: 'v3 — ADR-022 Option A: strict OPTIMAL>AVERAGE>WEAK ordering',
    gates,
    allPass,
    results,
  };

  const outPath = resolve(__dirnameCompat, '../art/profiling/rtp_audit_P6_42.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact written: ${outPath}`);

  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
