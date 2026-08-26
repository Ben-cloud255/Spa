'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('spa_token');
    const storedUser = localStorage.getItem('spa_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      connectSocket(storedToken);
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('spa_token', data.token);
    localStorage.setItem('spa_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    connectSocket(data.token);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('spa_token');
    localStorage.removeItem('spa_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
