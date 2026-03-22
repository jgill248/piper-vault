/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { User, LoginInput, RegisterInput, AuthResponse } from '@delve/shared';
import { api } from '../api/client';

const TOKEN_KEY = 'delve:auth:token';

interface AuthContextValue {
  readonly user: User | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // On mount (and whenever the token changes), validate it against /auth/me
  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const fetchedUser = await api.getMe(token);
        if (!cancelled) {
          setUser(fetchedUser ?? null);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          clearToken();
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    void validate();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (input: LoginInput): Promise<void> => {
    const response = await api.login(input);
    storeToken(response.token);
    setToken(response.token);
    setUser(toUser(response));
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<void> => {
    const response = await api.register(input);
    storeToken(response.token);
    setToken(response.token);
    setUser(toUser(response));
  }, []);

  const logout = useCallback((): void => {
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

function toUser(response: AuthResponse): User {
  return {
    id: response.user.id,
    username: response.user.username,
    email: response.user.email,
    role: response.user.role as 'user' | 'admin',
    createdAt:
      response.user.createdAt instanceof Date
        ? response.user.createdAt
        : new Date(response.user.createdAt as unknown as string),
  };
}
