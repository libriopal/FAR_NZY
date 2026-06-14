// Embedding-ready audit record.
// schemaVersion enables future migration detection.
// All fields required. The future Cohere Embed implementation
// operates on this corpus immediately — no migration needed.

export interface GovernanceAuditRecord {
  schemaVersion:   '1.0';             // increment only with a migration plan
  id:              string;            // nanoid()
  timestamp:       string;            // ISO8601
  auditType:       'governance' | 'monte-carlo' | 'economy' | 'opportunity';
  tags:            string[];          // e.g. ['rtp', 'SOLO_CASINO', 'patch-v1.2']
  proposal:        unknown;           // source input verbatim — typed by caller
  analysis:        string;            // AI findings
  recommendations: string[];          // structured list
  riskLevel:       'low' | 'medium' | 'high';
}
