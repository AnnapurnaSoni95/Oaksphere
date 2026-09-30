import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, TOKEN_KEY } from '../lib/api';
import { UserPermissions, getDefaultPermissions } from '../lib/types';

export type UserRole = 'admin' | 'team_leader' | 'recruiter';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  teamName?: string;
  phone?: string;
  dailyCallTarget: number;
  dailyConnectedTarget: number;
  dailyLineupTarget: number;
  monthlyJoiningTarget: number;
  permissions?: UserPermissions;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamName?: string;
  isActive: boolean;
  permissions?: UserPermissions;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  demoUsers: DemoUser[];
  login: (email: string, pass: string) => Promise<void>;
  switchDemoUser: (userId: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);

  const fetchDemoUsers = async () => {
    try {
      const res = await apiRequest<{ users: DemoUser[] }>('/api/auth/demo-users');
      setDemoUsers(res.users);
    } catch (e) {
      console.error('Failed to load demo accounts', e);
    }
  };

  const refreshUser = async () => {
    const curToken = localStorage.getItem(TOKEN_KEY);
    if (!curToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch (e) {
      console.warn('Session expired or invalid, logging out', e);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoUsers();
    // Default to admin or first account if no token exists yet
    const initAuth = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (!savedToken) {
        // Auto-login with admin demo account so preview is immediately functional
        try {
          const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'admin@oaksphere.com', password: 'admin123' }),
          });
          localStorage.setItem(TOKEN_KEY, res.token);
          setToken(res.token);
          setUser(res.user);
        } catch (err) {
          console.error('Default demo login error:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        refreshUser();
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const switchDemoUser = async (userId: string) => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/switch-demo', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        demoUsers,
        login,
        switchDemoUser,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
