import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';
import type { Student } from './types';

interface AuthState {
  loading: boolean;
  role: 'student' | 'admin' | null;
  student: Student | null;
  setStudent: (s: Student) => void;
  login: (token: string, role: 'student' | 'admin', student?: Student) => void;
  logout: () => void;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AuthState['role']>(null);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/me')
      .then((me) => {
        setRole(me.role);
        setStudent(me.student || null);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token: string, r: 'student' | 'admin', s?: Student) => {
    setToken(token);
    setRole(r);
    setStudent(s || null);
  }, []);

  const logout = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setRole(null);
    setStudent(null);
  }, []);

  return <Ctx.Provider value={{ loading, role, student, setStudent, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
