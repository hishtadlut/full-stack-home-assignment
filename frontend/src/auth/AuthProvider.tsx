import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import {
  clearAccessToken,
  discardPersistedAccessToken,
  setAccessToken as setStoredAccessToken,
} from './accessToken';
import { AuthContext } from './useAuth';
import type {
  AuthResponse,
  RegisterData,
  SecurityWarning,
} from './types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [securityWarnings, setSecurityWarnings] = useState<SecurityWarning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        discardPersistedAccessToken();
        const data = await refreshUserSession();

        if (data) {
          applyAuthResponse(data);
        } else {
          clearAuthState();
        }
      } catch {
        clearAuthState();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password });
    applyAuthResponse(data);
    setSecurityWarnings(data.securityWarnings ?? []);
    return data;
  }, []);

  const register = useCallback(async (userData: RegisterData) => {
    const data = await api.post<AuthResponse>('/auth/register', userData);
    applyAuthResponse(data);
    setSecurityWarnings(data.securityWarnings ?? []);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.delete('/auth/refresh');
    } catch {
      // Logout should still complete locally when the server session is already gone.
    } finally {
      clearAuthState();
      setSecurityWarnings([]);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, accessToken, securityWarnings, login, register, logout }),
    [user, loading, accessToken, securityWarnings, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

  function applyAuthResponse(data: AuthResponse) {
    setStoredAccessToken(data.token);
    discardPersistedAccessToken();
    setAccessToken(data.token);
    setUser(data.user);
  }

  function clearAuthState() {
    clearAccessToken();
    discardPersistedAccessToken();
    setAccessToken(null);
    setUser(null);
  }
};

const refreshUserSession = async () => {
  try {
    const data = await api.post<AuthResponse>('/auth/refresh');
    return data;
  } catch {
    return null;
  }
};
