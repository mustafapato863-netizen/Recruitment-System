import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, LoginRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const profile = await fetchApi<UserProfile>('/auth/me');
    if (profile?.id) setUser(profile);
  }, []);

  useEffect(() => {
    let isMounted = true;
    refreshUser()
      .catch(() => {
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    const handleUnauthorized = () => {
      if (isMounted) {
        setUser(null);
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshUser]);

  const login = async (credentials: LoginRequest) => {
    const result = await fetchApi<{ user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (result?.user) {
      setUser(result.user);
    } else {
      await refreshUser();
    }
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
