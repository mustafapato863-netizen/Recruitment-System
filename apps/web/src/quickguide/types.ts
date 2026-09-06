export interface PageGuideStep {
  number: number;
  title: string;
  description: string;
  actionHint?: string;
  targetSelector?: string;
  /** @deprecated Game tour leftovers — ignored by clean spotlight tour */
  questTitle?: string;
  /** @deprecated Game tour leftovers — ignored by clean spotlight tour */
  xpReward?: number;
  /** @deprecated Game tour leftovers — ignored by clean spotlight tour */
  badgeIcon?: string;
  instruction?: string;
}

export interface PageGuideKeyTerm {
  term: string;
  definition: string;
}

export interface PageGuideCaution {
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface PageGuide {
  id: string;
  routePattern: string;
  title: string;
  category: string;
  oneLiner: string;
  purpose: string;
  steps: PageGuideStep[];
  hardPartCaution: PageGuideCaution;
  keyTerms?: PageGuideKeyTerm[];
  proTips?: string[];
  /** @deprecated Game tour leftovers — ignored by clean spotlight tour */
  questRoleTitle?: string;
  /** @deprecated Game tour leftovers — ignored by clean spotlight tour */
  totalQuestXp?: number;
}

export interface QuickGuideContextValue {
  isOpen: boolean;
  currentGuide: PageGuide;
  activeTab: 'overview' | 'steps' | 'rules' | 'terms';
  hasSeenCurrentPage: boolean;
  autoOpenEnabled: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  toggleGuide: () => void;
  setActiveTab: (tab: 'overview' | 'steps' | 'rules' | 'terms') => void;
  markCurrentPageSeen: () => void;
  toggleAutoOpen: (enabled: boolean) => void;
  resetAllGuides: () => void;
  // Clean autofocus spotlight tour (famous-apps style)
  isTourActive: boolean;
  tourStepIndex: number;
  totalTourSteps: number;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
  // @deprecated aliases kept for backward compat — use isTourActive etc.
  isGameTourActive: boolean;
  gameStepIndex: number;
  totalGameSteps: number;
  startGameTour: () => void;
  nextGameStep: () => void;
  prevGameStep: () => void;
  endGameTour: () => void;
  /** @deprecated game sounds removed — always true, no-op toggle */
  soundEnabled: boolean;
  /** @deprecated quest completion removed — always false */
  isQuestCompleted: boolean;
  /** @deprecated XP removed — always 0 */
  totalEarnedXp: number;
  toggleSound: () => void;
}
