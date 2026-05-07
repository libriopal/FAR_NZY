import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  GameState,
  LevelConfig,
  TraySlot,
  ObjectiveState,
  MetaResources,
} from '@match3d/game-core';
import { GameSessionManager } from '@match3d/game-core';
import type { ComplianceProfile } from '@match3d/compliance';
import type { EconomyBalance } from '@match3d/economy';
import type { GameMode } from '@match3d/farkle-shared';

export interface AppState {
  // Auth
  userId: string | null;
  sessionId: string;
  isAuthenticated: boolean;

  // Compliance
  complianceProfile: ComplianceProfile | null;
  complianceApproved: boolean;

  // Game session
  session: GameSessionManager | null;
  gamePhase: GameState['phase'];
  score: number;
  timeRemaining: number;
  traySlots: TraySlot[];
  objectives: ObjectiveState[];
  comboCount: number;
  currentLevel: LevelConfig | null;

  // Meta
  resources: MetaResources;
  purchasedUpgradeIds: string[];

  // Economy
  economyBalance: EconomyBalance;

  // UI
  activeScreen: 'splash' | 'age_gate' | 'home' | 'game' | 'win' | 'lose' | 'meta' | 'shop' | 'social' | 'multiplayer';
  showReviveModal: boolean;
  showAdModal: boolean;
  selectedLevelId: string;
  gameMode: GameMode | null;

  // Actions
  setUserId: (id: string) => void;
  setSelectedLevelId: (id: string) => void;
  setGameMode: (mode: GameMode | null) => void;
  setComplianceApproved: (profile: ComplianceProfile) => void;
  setActiveScreen: (screen: AppState['activeScreen']) => void;
  setSession: (session: GameSessionManager) => void;
  updateGameState: (partial: Partial<Pick<AppState, 'gamePhase' | 'score' | 'timeRemaining' | 'traySlots' | 'objectives' | 'comboCount'>>) => void;
  updateResources: (resources: MetaResources) => void;
  updateEconomyBalance: (balance: EconomyBalance) => void;
  setShowReviveModal: (show: boolean) => void;
  setCurrentLevel: (level: LevelConfig) => void;
}

const SESSION_ID = Math.random().toString(36).slice(2);

export const useGameStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    userId: null,
    sessionId: SESSION_ID,
    isAuthenticated: false,

    complianceProfile: null,
    complianceApproved: false,

    session: null,
    gamePhase: 'idle',
    score: 0,
    timeRemaining: 0,
    traySlots: [],
    objectives: [],
    comboCount: 0,
    currentLevel: null,

    resources: { bioSteel: 0, aeroSeeds: 0, goldCoins: 500, sweepsCoins: 10 },
    purchasedUpgradeIds: [],

    economyBalance: { goldCoins: 500, sweepsCoins: 10, lastUpdated: 0 },

    activeScreen: 'splash',
    showReviveModal: false,
    showAdModal: false,
    selectedLevelId: 'level_10',
    gameMode: null,

    setUserId: (id) => set({ userId: id, isAuthenticated: true }),
    setComplianceApproved: (profile) => set({ complianceProfile: profile, complianceApproved: true }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setSession: (session) => set({ session }),
    updateGameState: (partial) => set(partial),
    updateResources: (resources) => set({ resources }),
    updateEconomyBalance: (balance) => set({ economyBalance: balance }),
    setShowReviveModal: (show) => set({ showReviveModal: show }),
    setCurrentLevel: (level) => set({ currentLevel: level }),
    setSelectedLevelId: (id) => set({ selectedLevelId: id }),
    setGameMode: (mode) => set({ gameMode: mode }),
  }))
);
