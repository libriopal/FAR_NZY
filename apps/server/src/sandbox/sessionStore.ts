// ─────────────────────────────────────────────────────
// FARKLE FRENZY — SURFACE FILE
// Sandbox session state manager — in-memory only, no persistence.
// ─────────────────────────────────────────────────────

// TODO: import from @match3d/farkle-shared when types are exported from that package

// ─── Inlined types (copied from sandbox-ui/src/types/sandbox.ts) ─────────────

type GameMode =
  | 'SOLO_FREE' | 'SOLO_CASINO'
  | 'VS_FREE'   | 'VS_CASINO'
  | 'RALLY_FREE'| 'RALLY_CASINO'
  | 'HEIST_FREE'| 'HEIST_CASINO';

type PlayerModel = 'OPTIMAL' | 'AVERAGE' | 'WEAK';
type AIAgent = 'kendo' | 'claude';

interface OWCParamsConfig {
  enabled: boolean;
  playerRank?: number;
  playerCount?: number;
  turnsElapsed?: number;
  targetRTP?: number;
}

interface SimConfig {
  mode: GameMode;
  sessions: number;
  maxTurns: number;
  playerModel: PlayerModel;
  blockerDensity: 'LOW' | 'MEDIUM' | 'HIGH';
  playerCount: 1 | 2 | 3 | 4;
  rolesActive: boolean;
  seed: number;
  targetRTP: number;
  bombSpawnRate: number;
  orbSpawnProbability: number;
  doublerSpawnEvery: number;
  owcParams?: OWCParamsConfig;
}

// MonteCarloResultV2 is opaque at the session-store level
// TODO: import full type from @match3d/farkle-shared when available
type MonteCarloResultV2 = Record<string, unknown> | null;

interface ConfigCommand {
  id: string;
  timestamp: number;
  description: string;
  before: Partial<SimConfig>;
  after: Partial<SimConfig>;
  simulationResultBefore: MonteCarloResultV2;
  simulationResultAfter: MonteCarloResultV2;
}

// ─── Default config ───────────────────────────────────────────────────────────

const BASE_CONFIG: SimConfig = {
  mode: 'SOLO_CASINO',
  sessions: 100_000,
  maxTurns: 30,
  playerModel: 'AVERAGE',
  blockerDensity: 'MEDIUM',
  playerCount: 1,
  rolesActive: false,
  seed: Date.now() & 0x7fffffff,
  targetRTP: 0.92,
  stakeAmount: 1,
  bombSpawnRate: 0.022,
  orbSpawnProbability: 0.15,
  doublerSpawnEvery: 3,
  owcParams: { enabled: false },
};

const MAX_UNDO = 50;

// ─── In-memory state ──────────────────────────────────────────────────────────

interface SessionState {
  sessionId: string;
  config: SimConfig;
  agent: AIAgent;
  undoStack: ConfigCommand[];
  redoStack: ConfigCommand[];
  checkpoints: { name: string; timestamp: number; config: SimConfig }[];
  lastResult: MonteCarloResultV2;
}

function genId(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function makeState(): SessionState {
  return {
    sessionId: genId(),
    config: { ...BASE_CONFIG, seed: Date.now() & 0x7fffffff },
    agent: 'kendo',
    undoStack: [],
    redoStack: [],
    checkpoints: [],
    lastResult: null,
  };
}

let state: SessionState = makeState();

// ─── Exported accessors ───────────────────────────────────────────────────────

export function getInitialState(): object {
  return {
    sessionId: state.sessionId,
    currentConfig: state.config,
    activeAgent: state.agent,
    undoDepth: state.undoStack.length,
    redoDepth: state.redoStack.length,
    undoStack: state.undoStack,
    checkpoints: state.checkpoints.map(c => ({ name: c.name, timestamp: c.timestamp })),
    lastResult: state.lastResult,
    gates: [],
    recommendations: [],
    isRunning: false,
    progress: null,
    log: [],
    chatMessages: [],
    isChatLoading: false,
    advisorUpdates: {},
  };
}

export function currentConfig(): SimConfig {
  return { ...state.config };
}

export function currentAgent(): AIAgent {
  return state.agent;
}

export function history(): ConfigCommand[] {
  return [...state.undoStack];
}

export function undoDepth(): number {
  return state.undoStack.length;
}

export function redoDepth(): number {
  return state.redoStack.length;
}

export function setLastResult(result: Record<string, unknown>): void {
  state.lastResult = result;
}

export function applyConfigChange(delta: Partial<SimConfig>): ConfigCommand {
  const before: Partial<SimConfig> = {};
  for (const key of Object.keys(delta) as (keyof SimConfig)[]) {
    (before as Record<string, unknown>)[key] = state.config[key];
  }
  const after = { ...delta };
  const cmd: ConfigCommand = {
    id: genId(),
    timestamp: Date.now(),
    description: buildDescription(delta),
    before,
    after,
    simulationResultBefore: state.lastResult,
    simulationResultAfter: null,
  };
  state.config = { ...state.config, ...delta };
  state.undoStack = [cmd, ...state.undoStack].slice(0, MAX_UNDO);
  state.redoStack = [];
  return cmd;
}

export function undo(): { config: SimConfig; cmd: ConfigCommand } | null {
  const cmd = state.undoStack[0];
  if (!cmd) return null;
  state.undoStack = state.undoStack.slice(1);
  state.redoStack = [cmd, ...state.redoStack];
  state.config = { ...state.config, ...cmd.before };
  return { config: { ...state.config }, cmd };
}

export function redo(): { config: SimConfig; cmd: ConfigCommand } | null {
  const cmd = state.redoStack[0];
  if (!cmd) return null;
  state.redoStack = state.redoStack.slice(1);
  state.undoStack = [cmd, ...state.undoStack].slice(0, MAX_UNDO);
  state.config = { ...state.config, ...cmd.after };
  return { config: { ...state.config }, cmd };
}

export function reset(): void {
  state = makeState();
}

export function saveCheckpoint(name: string): { name: string; timestamp: number } {
  const cp = { name, timestamp: Date.now(), config: { ...state.config } };
  state.checkpoints = [...state.checkpoints, cp];
  return { name: cp.name, timestamp: cp.timestamp };
}

export function setAgent(agent: AIAgent): void {
  state.agent = agent;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildDescription(delta: Partial<SimConfig>): string {
  const parts = Object.entries(delta).map(([k, v]) => {
    const old = (state.config as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && typeof old === 'number') {
      return `${k}: ${old.toFixed(3)} → ${v.toFixed(3)}`;
    }
    return `${k}: ${String(old)} → ${String(v)}`;
  });
  return parts.join(', ') || 'Config changed';
}
