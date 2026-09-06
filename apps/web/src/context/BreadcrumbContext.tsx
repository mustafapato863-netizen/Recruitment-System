import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type BreadcrumbContextType = {
  customLabels: Record<string, string>;
  setBreadcrumbLabel: (path: string, label: string) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  customLabels: {},
  setBreadcrumbLabel: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});

  const setBreadcrumbLabel = useCallback((path: string, label: string) => {
    setCustomLabels((prev) => {
      if (prev[path] === label) return prev;
      return { ...prev, [path]: label };
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ customLabels, setBreadcrumbLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}

/**
 * Hook for pages to dynamically set their friendly breadcrumb title (e.g. candidate name, interview title).
 */
export function useSetBreadcrumbTitle(title: string | undefined | null) {
  const { setBreadcrumbLabel } = useBreadcrumb();
  const location = useLocation();

  useEffect(() => {
    if (title && title.trim()) {
      setBreadcrumbLabel(location.pathname, title.trim());
    }
  }, [title, location.pathname, setBreadcrumbLabel]);
}
