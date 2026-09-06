export interface PageGuideStep {
  number: number;
  title: string;
  description: string;
  actionHint?: string;
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
}
