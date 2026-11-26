import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { AuthSessionResponse, UserProfile, LoginRequest } from '@recruitflow/contracts';
import { ApiError, fetchApi } from '../api/client';
import { clearViewCache, setViewCacheUser } from '../v2/api/viewCache';

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
  const authRequestVersion = useRef(0);
  const initialSessionCheckPending = useRef(true);
  const loginInFlight = useRef(false);

  const refreshUser = useCallback(async () => {
    const profile = await fetchApi<UserProfile>('/auth/me');
    if (profile?.id) {
      setViewCacheUser(profile.id);
      setUser(profile);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialRequestVersion = ++authRequestVersion.current;

    const checkSession = async () => {
      try {
        const session = await fetchApi<AuthSessionResponse>('/auth/session', undefined, false);
        if (!isMounted || authRequestVersion.current !== initialRequestVersion) return;
        if (session?.authenticated && session.user?.id) {
          setViewCacheUser(session.user.id);
          setUser(session.user);
          return;
        }
        if (session?.canRefresh || typeof session?.authenticated !== 'boolean') {
          await refreshUser();
          return;
        }
        setUser(null);
      } catch (err) {
        // Backwards compatibility: if the API deployment does not expose
        // /auth/session yet (e.g. split web/API deploy returning 404/405/501),
        // fall back to /auth/me so signed-in users keep their session on refresh.
        if (
          err instanceof ApiError &&
          (err.statusCode === 404 || err.statusCode === 405 || err.statusCode === 501)
        ) {
          try {
            await refreshUser();
            return;
          } catch {
            // Fall through to signed-out cleanup
          }
        }
        // Do not let the unauthenticated startup probe overwrite a login that
        // completed while the probe was still in flight.
        if (isMounted && authRequestVersion.current === initialRequestVersion) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          initialSessionCheckPending.current = false;
          setIsLoading(false);
        }
      }
    };

    void checkSession();

    const handleUnauthorized = () => {
      // A cold /login page performs an initial /auth/me probe. Its expected
      // 401 must not log out a login submitted before that probe settles.
      if (isMounted && !initialSessionCheckPending.current && !loginInFlight.current) {
        clearViewCache();
        setViewCacheUser(null);
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
    const loginVersion = ++authRequestVersion.current;
    loginInFlight.current = true;
    try {
      const result = await fetchApi<{ user: UserProfile }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (loginVersion !== authRequestVersion.current) return;
      if (result?.user) {
        clearViewCache();
        setViewCacheUser(result.user.id);
        setUser(result.user);
      } else {
        await refreshUser();
      }
    } finally {
      loginInFlight.current = false;
    }
  };

  const logout = async () => {
    authRequestVersion.current += 1;
    clearViewCache();
    setViewCacheUser(null);
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

export function useOptionalAuth(): AuthContextType | undefined {
  return useContext(AuthContext);
}
