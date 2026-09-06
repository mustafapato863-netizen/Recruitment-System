import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { PageGuide, QuickGuideContextValue } from './types';
import { getPageGuideForPath, DEFAULT_PAGE_GUIDE } from './pageGuidesData';

const QuickGuideContext = createContext<QuickGuideContextValue | null>(null);

const STORAGE_PREFIX = 'rf_seen_guide_';
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

  // Update hasSeen when route / guide changes
  useEffect(() => {
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

  const resetAllGuides = useCallback(() => {
    try {
      // Remove all seen keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
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
      markCurrentPageSeen,
      toggleAutoOpen,
      resetAllGuides,
    ],
  );

  return <QuickGuideContext.Provider value={value}>{children}</QuickGuideContext.Provider>;
};

/**
 * Hook to consume the Quick Guide context with a safe fallback when used outside provider.
 */
export function useQuickGuide(): QuickGuideContextValue {
  const context = useContext(QuickGuideContext);

  if (!context) {
    // Safe fallback if used outside provider (e.g. isolated component unit tests)
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
    };
  }

  return context;
}
