// Seeds the §32/§33 Experiment/Hypothesis registries from
// D2_STAGE1_RESEARCH_ENVIRONMENT_HANDOFF_V3.md §9 (D2 continuity loop) and
// §10 (question bank) verbatim text — content is not invented here.
//
// Idempotent: experiments/hypotheses upsert by primary key, safe to re-run.
// Requires SUPABASE_URL / SUPABASE_SERVICE_KEY to be set (same as the
// evidence API server) — this script talks to Supabase directly, no running
// server required.
//
// Run: node --import tsx/esm scripts/seed-evidence-registry.ts

import { upsertExperiment, upsertHypothesis, listExperiments, listHypotheses } from '../apps/server/src/evidence/evidenceStore.js';
import type { Experiment, Hypothesis } from '../apps/server/src/evidence/types.js';

const EPOCH_ID = process.env['EVIDENCE_EPOCH_ID'] ?? 'stage1_a';

// §10 question bank, verbatim bullets.
const experiments: Experiment[] = [
  { experiment_id: 'EXP_ATTENTION_01', epoch_id: EPOCH_ID, question: 'What attracts player attention?', surface: 'gameplay_session', captured_fields: [], enabled: true },
  { experiment_id: 'EXP_CONFUSION_01', epoch_id: EPOCH_ID, question: 'What confuses players?', surface: 'gameplay_session', captured_fields: [], enabled: true },
  { experiment_id: 'EXP_CHOICE_01', epoch_id: EPOCH_ID, question: 'What choices do players make?', surface: 'gameplay_session', captured_fields: [], enabled: true },
  { experiment_id: 'EXP_IGNORED_01', epoch_id: EPOCH_ID, question: 'What interactions are ignored?', surface: 'gameplay_session', captured_fields: [], enabled: true },
  { experiment_id: 'EXP_CURIOSITY_01', epoch_id: EPOCH_ID, question: 'What creates curiosity/exploration?', surface: 'gameplay_session', captured_fields: [], enabled: true },
];

// §9 D2 continuity loop: perceive → calibrate → commit → consequence → feedback → persist.
// PLACEHOLDER classification (see warning in main()) — human must confirm
// VF/SI/AS/SP/SC definitions against the handoff before this is treated as final.
const hypotheses: Hypothesis[] = [
  { hypothesis_id: 'HYP_PERCEIVE_01', epoch_id: EPOCH_ID, question: 'Does the player perceive the board state before acting?', classification: 'SP' },
  { hypothesis_id: 'HYP_CALIBRATE_01', epoch_id: EPOCH_ID, question: 'Does the player calibrate risk/expectation before committing?', classification: 'SP' },
  { hypothesis_id: 'HYP_COMMIT_01', epoch_id: EPOCH_ID, question: "What does the player's commit action reveal about their read of the situation?", classification: 'SP' },
  { hypothesis_id: 'HYP_CONSEQUENCE_01', epoch_id: EPOCH_ID, question: 'How does the player respond to the consequence of their commit?', classification: 'SP' },
  { hypothesis_id: 'HYP_FEEDBACK_01', epoch_id: EPOCH_ID, question: 'Does in-game feedback change subsequent behavior?', classification: 'SP' },
  { hypothesis_id: 'HYP_PERSIST_01', epoch_id: EPOCH_ID, question: 'Does a pattern from this loop persist across sessions?', classification: 'SP' },
];

async function main() {
  console.warn(
    '[seed] hypotheses.classification is a PLACEHOLDER ("SP" for all) — ' +
    'confirm the actual VF/SI/AS/SP/SC definitions against the handoff before treating this as final.',
  );

  for (const e of experiments) await upsertExperiment(e);
  for (const h of hypotheses) await upsertHypothesis(h);

  console.log('experiments now in registry:', (await listExperiments(EPOCH_ID)).map(e => e.experiment_id));
  console.log('hypotheses now in registry:', (await listHypotheses(EPOCH_ID)).map(h => h.hypothesis_id));
}

main();
