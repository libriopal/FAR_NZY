// Direct gate validation — runs runMonteCarloV2 with seed=42, 50k sessions.
// Mirrors the /rtp-audit endpoint gate logic exactly. No server required.

import { runMonteCarloV2 } from '@match3d/farkle-engine/monteCarlo';
import type { SimConfig } from '@match3d/farkle-engine/monteCarlo';

const SEED     = 42;
const SESSIONS = 50_000;

const modes  = ['SOLO_CASINO', 'VS_CASINO', 'RALLY_CASINO'] as const;
const models = ['OPTIMAL', 'AVERAGE', 'WEAK'] as const;

async function main() {
  console.log(`Running gate audit: seed=${SEED}, sessions=${SESSIONS} per config\n`);

  const results: Record<string, Awaited<ReturnType<typeof runMonteCarloV2>>> = {};

  for (const m of modes) {
    for (const p of models) {
      const config: SimConfig = {
        mode:           m,
        sessions:       SESSIONS,
        maxTurns:       30,
        playerModel:    p,
        blockerDensity: 'MEDIUM',
        playerCount:    m === 'SOLO_CASINO' ? 1 : 4,
        rolesActive:    m === 'RALLY_CASINO',
        roles:          m === 'RALLY_CASINO' ? ['RAINMAKER', 'HEADHUNTER', 'ARCHIVIST', 'CONDUCTOR'] : [],
        seed:           SEED ^ (modes.indexOf(m) * 31) ^ (models.indexOf(p) * 7),
      };
      process.stdout.write(`  ${m}/${p}... `);
      const r = await runMonteCarloV2(config);
      results[`${m}_${p}`] = r;
      console.log(`avgScore=${r.averageScore} farkleRate=${r.farkleRate} owcRTP=${r.owcContributionRTP}`);
    }
  }

  const soloOpt  = results['SOLO_CASINO_OPTIMAL']!;
  const soloAvg  = results['SOLO_CASINO_AVERAGE']!;
  const soloWeak = results['SOLO_CASINO_WEAK']!;

  const soloRTP  = Number((soloAvg.averageScore / soloAvg.normalizer).toFixed(4));
  const optRTP   = Number((soloOpt.averageScore / soloOpt.normalizer).toFixed(4));
  const weakRTP  = Number((soloWeak.averageScore / soloWeak.normalizer).toFixed(4));
  const skillGap = Number(Math.abs(optRTP - weakRTP).toFixed(4));

  const gates = {
    Gate1: { pass: soloOpt.sessionsRun >= 1,                               metric: 'completions',                value: soloOpt.sessionsRun,  threshold: '≥1' },
    Gate2: { pass: soloRTP >= 0.82 && soloRTP <= 1.02,                     metric: 'rtp_band (avgScore/norm)',   value: soloRTP,              threshold: 'SOLO 0.82–1.02' },
    Gate3: { pass: soloOpt.averageScore !== soloWeak.averageScore,          metric: 'skill_differentiation',      value: skillGap,             threshold: 'OPTIMAL≠WEAK' },
    Gate4: { pass: soloOpt.farkleRate >= 0.85 && soloOpt.farkleRate <= 0.95, metric: 'farkle_rate (per-turn)',   value: soloOpt.farkleRate,   threshold: '0.85–0.95' },
    Gate5: { pass: soloOpt.p5Score >= 0 && soloAvg.averageScore > 100,     metric: 'p5Score≥0 & avgScore>100',   value: soloOpt.p5Score,      threshold: 'p5≥0, avg>100' },
    Gate6: { pass: soloOpt.normalizer > 0,                                  metric: 'normalizer',                 value: soloOpt.normalizer,   threshold: '>0' },
  };

  console.log('\n─── Gate Results ───────────────────────────────────────────────');
  let allPass = true;
  for (const [name, g] of Object.entries(gates)) {
    const status = g.pass ? 'PASS' : 'FAIL';
    if (!g.pass) allPass = false;
    console.log(`${status}  ${name}  ${g.metric} = ${g.value}  [${g.threshold}]`);
  }
  console.log('────────────────────────────────────────────────────────────────');
  console.log(allPass ? '\nAll 6 gates PASS ✓' : '\nSome gates FAILED ✗');
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
