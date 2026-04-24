import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  name: string;
  subscription: 'free' | 'basic' | 'premium' | 'enterprise';
  uploadCount: number;
  uploadLimit: number | null;
  uploadsRemaining: number | null;
}

interface AuthContextType {
  user: User | null;
  authReady: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateSubscription: (plan: 'free' | 'basic' | 'premium' | 'enterprise') => Promise<boolean>;
  consumeUpload: () => Promise<{ allowed: boolean; message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PHP_API_BASE_URL = import.meta.env.VITE_PHP_API_URL ?? 'http://127.0.0.1:8080';
const TOKEN_STORAGE_KEY = 'deeptrust_auth_token';

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${PHP_API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const refreshUser = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setAuthReady(true);
      return;
    }

    try {
      const { response, payload } = await apiRequest('/auth/me');
      if (!response.ok || !payload?.user) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setUser(null);
        setAuthReady(true);
        return;
      }

      setUser(payload.user);
      setAuthReady(true);
    } catch (_error) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setUser(null);
      setAuthReady(true);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { response, payload } = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok || !payload?.token || !payload?.user) {
      return false;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    setUser(payload.user);
    return true;
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    const { response, payload } = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok || !payload?.token || !payload?.user) {
      return false;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    setUser(payload.user);
    return true;
  };

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  };

  const updateSubscription = async (plan: 'free' | 'basic' | 'premium' | 'enterprise') => {
    if (!user) {
      return false;
    }

    const { response, payload } = await apiRequest('/subscription/update', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });

    if (!response.ok || !payload?.user) {
      return false;
    }

    setUser(payload.user);
    return true;
  };

  const consumeUpload = async () => {
    if (!user) {
      return { allowed: false, message: 'Please log in to use file uploads.' };
    }

    const { response, payload } = await apiRequest('/usage/consume-upload', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok || payload?.allowed === false) {
      if (payload?.user) {
        setUser(payload.user);
      }
      return {
        allowed: false,
        message: payload?.error || 'Upload not allowed for your current plan.',
      };
    }

    if (payload?.user) {
      setUser(payload.user);
    }
    return { allowed: true };
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, signup, logout, updateSubscription, consumeUpload, refreshUser }}>
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
