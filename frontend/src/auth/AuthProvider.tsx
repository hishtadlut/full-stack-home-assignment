import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import { AuthContext } from './useAuth';
import type {
  AuthResponse,
  MeResponse,
  RegisterData,
  SecurityWarning,
} from './types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [securityWarnings, setSecurityWarnings] = useState<SecurityWarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const applyRefreshedSession = async () => {
        const refreshedUser = await refreshUserSession();
        setUser(refreshedUser);
        setSecurityWarnings([]);
      };

      const token = localStorage.getItem('token');

      if (!token) {
        await applyRefreshedSession();
        setLoading(false);
        return;
      }

      try {
        const data = await api.get<MeResponse>('/auth/me');
        setUser(data.user);
      } catch {
        localStorage.removeItem('token');
        await applyRefreshedSession();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setSecurityWarnings(data.securityWarnings ?? []);
    return data;
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    const data = await api.post<AuthResponse>('/auth/register', userData);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setSecurityWarnings(data.securityWarnings ?? []);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.delete('/auth/refresh');
    } catch {
      // Logout should still complete locally when the server session is already gone.
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      setSecurityWarnings([]);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, securityWarnings, login, register, logout }),
    [user, loading, securityWarnings, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const refreshUserSession = async () => {
  try {
    const data = await api.post<AuthResponse>('/auth/refresh');
    localStorage.setItem('token', data.token);
    return data.user;
  } catch {
    localStorage.removeItem('token');
    return null;
  }
};
