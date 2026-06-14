// All Cohere AI configuration — sourced from environment variables.
// Never hardcode values here. Add to .env.example for every new key.

export const AI_CONFIG = {
  // Provider
  cohereApiKey:        process.env.COHERE_API_KEY ?? '',
  questModel:          process.env.COHERE_QUEST_MODEL ?? 'command-r7b-12-2024',
  rtpModel:            process.env.COHERE_RTP_MODEL ?? 'command-r-08-2024',

  // Budget ceilings (USD)
  budgetGovernance:    Number(process.env.COHERE_BUDGET_GOVERNANCE ?? 300),
  budgetMonteCarlo:    Number(process.env.COHERE_BUDGET_MONTE_CARLO ?? 250),
  budgetOpportunity:   Number(process.env.COHERE_BUDGET_OPPORTUNITY ?? 150),
  budgetRetrieval:     Number(process.env.COHERE_BUDGET_RETRIEVAL ?? 150),
  budgetQuest:         Number(process.env.COHERE_BUDGET_QUEST ?? 50),

  // Budget thresholds (fraction of ceiling)
  thresholdWarn:       Number(process.env.COHERE_THRESHOLD_WARN ?? 0.75),
  thresholdRestrict:   Number(process.env.COHERE_THRESHOLD_RESTRICT ?? 0.90),
  thresholdShutdown:   Number(process.env.COHERE_THRESHOLD_SHUTDOWN ?? 1.00),

  // Monte Carlo escalation thresholds
  mcEscalationEnabled:    process.env.COHERE_MONTE_CARLO_ESCALATION_ENABLED !== 'false',
  mcRtpDeltaThreshold:    Number(process.env.COHERE_RTP_DELTA_THRESHOLD ?? 0.03),
  mcFarkleMax:            Number(process.env.COHERE_FARKLE_MAX ?? 0.22),
  mcFarkleMin:            Number(process.env.COHERE_FARKLE_MIN ?? 0.08),
  mcConfidenceWidthMax:   Number(process.env.COHERE_CONFIDENCE_WIDTH ?? 0.06),

  // Quest generation
  questBatchMax:       Number(process.env.QUEST_BATCH_MAX ?? 25),

  // Cache
  cacheTtlMs:          Number(process.env.COHERE_CACHE_TTL_MS ?? 3_600_000), // 1 hour
} as const;
