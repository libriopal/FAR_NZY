// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// D2 Stage-1 evidence endpoints. Read-only against CORE; writes only to
// the evidence tables (§12/§19/§31-§35). Never blocks gameplay.
// ─────────────────────────────────────────────────────

import { Router } from 'express';
import { recordDiscoveryEvent, upsertExperiment, listExperiments, upsertHypothesis, listHypotheses } from './evidenceStore.js';
import { buildEvidenceReturnPackage } from './evidenceExport.js';
import type { DiscoveryEventType } from './types.js';

const router = Router();

const VALID_EVENT_TYPES: DiscoveryEventType[] = [
  'discovery_claim',
  'theory_created',
  'hypothesis_recorded',
  'question_created',
  'session_retrospective',
];

// §13/§31: optional, non-blocking discovery-notes capture — raw human text only.
router.post('/discovery', (req, res) => {
  const { session_id, player_id, epoch_id, event_type, text, context } = req.body as {
    session_id?: string;
    player_id?: string;
    epoch_id?: string;
    event_type?: string;
    text?: string;
    context?: Record<string, unknown>;
  };

  if (!player_id || !text || typeof text !== 'string') {
    return res.status(400).json({ error: 'player_id and text are required' });
  }
  const type = VALID_EVENT_TYPES.includes(event_type as DiscoveryEventType)
    ? (event_type as DiscoveryEventType)
    : 'discovery_claim';

  // §36: epoch is a human-set, server-side concept — default from env rather
  // than requiring every client call site to know and pass it.
  const resolvedEpochId = epoch_id ?? process.env['EVIDENCE_EPOCH_ID'] ?? undefined;
  recordDiscoveryEvent({ session_id, player_id, epoch_id: resolvedEpochId, event_type: type, text, context });
  return res.status(202).json({ accepted: true });
});

// §38: optional single end-of-session free-text prompt — stored as a
// discovery-class event, never blocks session end, may be skipped client-side.
router.post('/retrospective', (req, res) => {
  const { session_id, player_id, epoch_id, text } = req.body as {
    session_id?: string;
    player_id?: string;
    epoch_id?: string;
    text?: string;
  };

  if (!player_id || !text || typeof text !== 'string') {
    return res.status(400).json({ error: 'player_id and text are required' });
  }

  const resolvedEpochId = epoch_id ?? process.env['EVIDENCE_EPOCH_ID'] ?? undefined;
  recordDiscoveryEvent({ session_id, player_id, epoch_id: resolvedEpochId, event_type: 'session_retrospective', text });
  return res.status(202).json({ accepted: true });
});

// §32 Experiment Registry — configurable data, not hardcoded telemetry.
router.get('/experiments', async (req, res) => {
  const epoch_id = typeof req.query['epoch_id'] === 'string' ? req.query['epoch_id'] : undefined;
  const experiments = await listExperiments(epoch_id);
  return res.json({ experiments });
});

router.post('/experiments', async (req, res) => {
  try {
    await upsertExperiment(req.body);
    return res.status(202).json({ accepted: true });
  } catch (e) {
    return res.status(400).json({ error: String(e) });
  }
});

// §33 Hypothesis Registry — registration only, never evaluated in Stage 1.
router.get('/hypotheses', async (req, res) => {
  const epoch_id = typeof req.query['epoch_id'] === 'string' ? req.query['epoch_id'] : undefined;
  const hypotheses = await listHypotheses(epoch_id);
  return res.json({ hypotheses });
});

router.post('/hypotheses', async (req, res) => {
  try {
    await upsertHypothesis(req.body);
    return res.status(202).json({ accepted: true });
  } catch (e) {
    return res.status(400).json({ error: String(e) });
  }
});

// §35 Evidence Return Package — the canonical Stage-1 → Claude Design upload artifact.
router.get('/export', async (req, res) => {
  try {
    const epoch_id = typeof req.query['epoch_id'] === 'string' ? req.query['epoch_id'] : undefined;
    const pkg = await buildEvidenceReturnPackage(epoch_id);
    return res.json(pkg);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

export { router as evidenceRouter };
