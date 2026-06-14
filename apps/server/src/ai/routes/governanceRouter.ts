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
