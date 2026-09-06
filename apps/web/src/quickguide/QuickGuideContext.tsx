import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { PageGuide, QuickGuideContextValue } from './types';
import { getPageGuideForPath, DEFAULT_PAGE_GUIDE } from './pageGuidesData';
import { gameSounds } from './gameSounds';

const QuickGuideContext = createContext<QuickGuideContextValue | null>(null);

const STORAGE_PREFIX = 'rf_seen_guide_';
const QUEST_COMPLETED_PREFIX = 'rf_quest_completed_';
const AUTO_OPEN_STORAGE_KEY = 'rf_quickguide_auto_open';
const SOUND_STORAGE_KEY = 'rf_game_sound_enabled';

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

  // Game Tour States
  const [isGameTourActive, setIsGameTourActive] = useState<boolean>(false);
  const [gameStepIndex, setGameStepIndex] = useState<number>(0);
  const [isQuestCompleted, setIsQuestCompleted] = useState<boolean>(false);

  // Sound preference (default true)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

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
    setIsGameTourActive(false);
    setGameStepIndex(0);
    setIsQuestCompleted(false);

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

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Game Tour Actions
  const totalGameSteps = currentGuide.steps.length;

  const startGameTour = useCallback(() => {
    setIsOpen(false); // close static modal
    setGameStepIndex(0);
    setIsQuestCompleted(false);
    setIsGameTourActive(true);
    markCurrentPageSeen();

    if (soundEnabled) {
      gameSounds.playStepAdvance();
    }
  }, [markCurrentPageSeen, soundEnabled]);

  const nextGameStep = useCallback(() => {
    if (gameStepIndex < totalGameSteps - 1) {
      setGameStepIndex((prev) => prev + 1);
      if (soundEnabled) {
        gameSounds.playStepAdvance();
      }
    } else {
      // Completed all steps!
      setIsQuestCompleted(true);
      try {
        localStorage.setItem(QUEST_COMPLETED_PREFIX + currentGuide.id, 'true');
      } catch {
        // ignore
      }
      if (soundEnabled) {
        gameSounds.playVictoryFanfare();
      }
    }
  }, [gameStepIndex, totalGameSteps, currentGuide.id, soundEnabled]);

  const prevGameStep = useCallback(() => {
    if (gameStepIndex > 0) {
      setGameStepIndex((prev) => prev - 1);
      if (soundEnabled) {
        gameSounds.playStepAdvance();
      }
    }
  }, [gameStepIndex, soundEnabled]);

  const endGameTour = useCallback(() => {
    setIsGameTourActive(false);
    setIsQuestCompleted(false);
    setGameStepIndex(0);
  }, []);

  const totalEarnedXp = useMemo(() => {
    return currentGuide.steps.reduce((sum, step) => sum + (step.xpReward || 25), 0);
  }, [currentGuide.steps]);

  const resetAllGuides = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(QUEST_COMPLETED_PREFIX)) {
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
      // Game Tour
      isGameTourActive,
      gameStepIndex,
      totalGameSteps,
      soundEnabled,
      isQuestCompleted,
      totalEarnedXp,
      startGameTour,
      nextGameStep,
      prevGameStep,
      endGameTour,
      toggleSound,
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
      isGameTourActive,
      gameStepIndex,
      totalGameSteps,
      soundEnabled,
      isQuestCompleted,
      totalEarnedXp,
      startGameTour,
      nextGameStep,
      prevGameStep,
      endGameTour,
      toggleSound,
    ],
  );

  return <QuickGuideContext.Provider value={value}>{children}</QuickGuideContext.Provider>;
};

export function useQuickGuide(): QuickGuideContextValue {
  const context = useContext(QuickGuideContext);

  if (!context) {
    return {
      isOpen: false,
      currentGuide: DEFAULT_PAGE_GUIDE,
      activeTab: 'overview',
      hasSeenCurrentPage: true,
      autoOpenEnabled: true,
      openGuide: () => {},
      closeGuide: () => {},
      toggleGuide: () => {},
      setActiveTab: () => {},
      markCurrentPageSeen: () => {},
      toggleAutoOpen: () => {},
      resetAllGuides: () => {},
      isGameTourActive: false,
      gameStepIndex: 0,
      totalGameSteps: 1,
      soundEnabled: true,
      isQuestCompleted: false,
      totalEarnedXp: 100,
      startGameTour: () => {},
      nextGameStep: () => {},
      prevGameStep: () => {},
      endGameTour: () => {},
      toggleSound: () => {},
    };
  }

  return context;
}
