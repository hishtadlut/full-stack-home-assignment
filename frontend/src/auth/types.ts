import type { User } from '../types';

export interface AuthResponse {
  user: User;
  token: string;
  securityWarnings?: SecurityWarning[];
}

export interface MeResponse {
  user: User;
}

export interface SecurityWarning {
  eventType: 'refresh_token_reuse';
  time: string;
  ip: string | null;
  userAgent: string | null;
  approxLocation: string | null;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  name?: string;
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  securityWarnings: SecurityWarning[];
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (userData: RegisterData) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}
