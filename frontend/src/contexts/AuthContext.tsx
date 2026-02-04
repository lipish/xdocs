import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiFetch, clearToken, getToken, setToken } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface DirectoryUser {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  directoryUsers: DirectoryUser[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  createUser: (username: string, email: string, password: string, role: 'admin' | 'user') => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    apiFetch<User>('/me')
      .then(async (u) => {
        setUser(u);
        await refreshDirectoryUsers();
        await refreshUsersIfAdmin(u);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      });
  }, []);

  const refreshDirectoryUsers = async () => {
    const list = await apiFetch<DirectoryUser[]>('/user-directory');
    setDirectoryUsers(list);
  };

  const refreshUsersIfAdmin = async (current: User | null) => {
    if (!current || current.role !== 'admin') {
      setUsers([]);
      return;
    }
    const list = await apiFetch<User[]>('/users');
    setUsers(list);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const resp = await apiFetch<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(resp.token);
      setUser(resp.user);
      await refreshDirectoryUsers();
      await refreshUsersIfAdmin(resp.user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setUsers([]);
    setDirectoryUsers([]);
    clearToken();
  };

  const createUser = async (
    username: string,
    email: string,
    password: string,
    role: 'admin' | 'user'
  ): Promise<boolean> => {
    try {
      await apiFetch<User>('/users', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role }),
      });
      await refreshUsersIfAdmin(user);
      return true;
    } catch {
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      await apiFetch<void>(`/users/${userId}`, { method: 'DELETE' });
      await refreshUsersIfAdmin(user);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        directoryUsers,
        login,
        logout,
        createUser,
        deleteUser,
        isAdmin: user?.role === 'admin',
      }}
    >
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
