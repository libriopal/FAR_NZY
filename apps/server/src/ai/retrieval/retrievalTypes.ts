// Stable contracts for Tier 3 embedding implementation.
// These types must not change without a schema migration plan.
// The GovernanceAuditRecord corpus (runs/governance/*.json) is the
// primary data source — it is already embedding-ready on day one.

export interface RetrievalSource {
  id:       string;
  type:     'governance-audit'
          | 'monte-carlo-report'
          | 'adr'
          | 'compliance-report'
          | 'economy-report'
          | 'opportunity-report'
          | 'simulation-report';
  location: string; // file path now; vector DB key in Tier 3
}

export interface AuditDocument {
  id:        string;
  content:   string;
  source:    RetrievalSource;
  createdAt: string;
}

export interface RTPReport {
  id:         string;
  mode:       string;
  targetRTP:  number;
  actualRTP:  number;
  sessions:   number;
  createdAt:  string;
}

export interface GovernanceAudit {
  id:              string;
  auditType:       string;
  riskLevel:       string;
  recommendations: string[];
  createdAt:       string;
}

export interface DesignDecision {
  id:           string;
  title:        string;
  context:      string;
  decision:     string;
  consequences: string;
  createdAt:    string;
}

export interface SimulationAnalysis {
  id:          string;
  mode:        string;
  sessions:    number;
  avgScore:    number;
  farkleRate:  number;
  findings:    string[];
  createdAt:   string;
}
