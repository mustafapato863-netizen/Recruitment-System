import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile, LoginRequest } from '@recruitflow/contracts';
import { fetchApi } from '../api/client';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApi<UserProfile>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (credentials: LoginRequest) => {
    await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const profile = await fetchApi<UserProfile>('/auth/me');
    setUser(profile);
  };

  const logout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
