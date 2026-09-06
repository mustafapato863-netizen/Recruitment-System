import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { PageGuide, QuickGuideContextValue } from './types';
import { getPageGuideForPath, DEFAULT_PAGE_GUIDE } from './pageGuidesData';

const QuickGuideContext = createContext<QuickGuideContextValue | null>(null);

const STORAGE_PREFIX = 'rf_seen_guide_';
const TOUR_COMPLETED_PREFIX = 'rf_tour_completed_';
const AUTO_OPEN_STORAGE_KEY = 'rf_quickguide_auto_open';

interface QuickGuideProviderProps {
  children: React.ReactNode;
}

export const QuickGuideProvider: React.FC<QuickGuideProviderProps> = ({ children }) => {
  const location = useLocation();

  // Resolve active guide based on URL path
  const currentGuide = useMemo<PageGuide>(() => {
    return getPageGuideForPath(location.pathname);
  }, [location.pathname]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'rules' | 'terms'>('overview');

  // Clean spotlight tour state (famous-apps style: no game, no XP, no sounds)
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  // Load auto-open preference (default to true)
  const [autoOpenEnabled, setAutoOpenEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_OPEN_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  // Check if current page has been seen before
  const checkHasSeen = useCallback((guideId: string): boolean => {
    try {
      return localStorage.getItem(STORAGE_PREFIX + guideId) === 'true';
    } catch {
      return false;
    }
  }, []);

  const [hasSeenCurrentPage, setHasSeenCurrentPage] = useState<boolean>(() => {
    return checkHasSeen(currentGuide.id);
  });

  // Reset or close tour on route change
  useEffect(() => {
    setIsTourActive(false);
    setTourStepIndex(0);

    const seen = checkHasSeen(currentGuide.id);
    setHasSeenCurrentPage(seen);
    setActiveTab('overview');

    // First-time visit auto-open logic
    if (autoOpenEnabled && !seen) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentGuide.id, autoOpenEnabled, checkHasSeen]);

  const openGuide = useCallback(() => {
    setActiveTab('overview');
    setIsOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleGuide = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const markCurrentPageSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + currentGuide.id, 'true');
    } catch {
      // Ignore storage errors
    }
    setHasSeenCurrentPage(true);
  }, [currentGuide.id]);

  const toggleAutoOpen = useCallback((enabled: boolean) => {
    setAutoOpenEnabled(enabled);
    try {
      localStorage.setItem(AUTO_OPEN_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Clean tour actions
  const totalTourSteps = currentGuide.steps.length;

  const startTour = useCallback(() => {
    setIsOpen(false); // close static modal
    setTourStepIndex(0);
    setIsTourActive(true);
    markCurrentPageSeen();
  }, [markCurrentPageSeen]);

  const nextTourStep = useCallback(() => {
    if (tourStepIndex < totalTourSteps - 1) {
      setTourStepIndex((prev) => prev + 1);
    } else {
      // Last step Done — persist completion and close (no victory splash)
      try {
        localStorage.setItem(TOUR_COMPLETED_PREFIX + currentGuide.id, 'true');
      } catch {
        // ignore
      }
      setIsTourActive(false);
      setTourStepIndex(0);
    }
  }, [tourStepIndex, totalTourSteps, currentGuide.id]);

  const prevTourStep = useCallback(() => {
    if (tourStepIndex > 0) {
      setTourStepIndex((prev) => prev - 1);
    }
  }, [tourStepIndex]);

  const endTour = useCallback(() => {
    setIsTourActive(false);
    setTourStepIndex(0);
  }, []);

  const resetAllGuides = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(TOUR_COMPLETED_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
    setHasSeenCurrentPage(false);
    openGuide();
  }, [openGuide]);

  const value = useMemo<QuickGuideContextValue>(
    () => ({
      isOpen,
      currentGuide,
      activeTab,
      hasSeenCurrentPage,
      autoOpenEnabled,
      openGuide,
      closeGuide,
      toggleGuide,
      setActiveTab,
      markCurrentPageSeen,
      toggleAutoOpen,
      resetAllGuides,
      // Clean tour (primary API)
      isTourActive,
      tourStepIndex,
      totalTourSteps,
      startTour,
      nextTourStep,
      prevTourStep,
      endTour,
      // Deprecated aliases (backward compat)
      isGameTourActive: isTourActive,
      gameStepIndex: tourStepIndex,
      totalGameSteps: totalTourSteps,
      startGameTour: startTour,
      nextGameStep: nextTourStep,
      prevGameStep: prevTourStep,
      endGameTour: endTour,
      soundEnabled: true,
      isQuestCompleted: false,
      totalEarnedXp: 0,
      toggleSound: () => {},
    }),
    [
      isOpen,
      currentGuide,
      activeTab,
      hasSeenCurrentPage,
      autoOpenEnabled,
      openGuide,
      closeGuide,
      toggleGuide,
      setActiveTab,
      markCurrentPageSeen,
      toggleAutoOpen,
      resetAllGuides,
      isTourActive,
      tourStepIndex,
      totalTourSteps,
      startTour,
      nextTourStep,
      prevTourStep,
      endTour,
    ],
  );

  return <QuickGuideContext.Provider value={value}>{children}</QuickGuideContext.Provider>;
};

export function useQuickGuide(): QuickGuideContextValue {
  const context = useContext(QuickGuideContext);

  if (!context) {
    const noop = () => {};
    return {
      isOpen: false,
      currentGuide: DEFAULT_PAGE_GUIDE,
      activeTab: 'overview',
      hasSeenCurrentPage: true,
      autoOpenEnabled: true,
      openGuide: noop,
      closeGuide: noop,
      toggleGuide: noop,
      setActiveTab: noop,
      markCurrentPageSeen: noop,
      toggleAutoOpen: noop,
      resetAllGuides: noop,
      isTourActive: false,
      tourStepIndex: 0,
      totalTourSteps: 1,
      startTour: noop,
      nextTourStep: noop,
      prevTourStep: noop,
      endTour: noop,
      isGameTourActive: false,
      gameStepIndex: 0,
      totalGameSteps: 1,
      startGameTour: noop,
      nextGameStep: noop,
      prevGameStep: noop,
      endGameTour: noop,
      soundEnabled: true,
      isQuestCompleted: false,
      totalEarnedXp: 0,
      toggleSound: noop,
    };
  }

  return context;
}
