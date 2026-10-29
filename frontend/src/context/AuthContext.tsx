import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../api';

interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: string;
  department_id?: string;
}

interface AuthContextType {
  currentUser: User | null;
  activeRole: UserRole;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isVerificationModalOpen: boolean;
  setIsVerificationModalOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('PUBLIC');
  const [token, setToken] = useState<string | null>(localStorage.getItem('civictrust_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');

  const refreshUser = async () => {
    try {
      const storedToken = localStorage.getItem('civictrust_token');
      if (storedToken) {
        const user = await api.getMe();
        setCurrentUser(user);
        setActiveRole(user.role);
      } else {
        setCurrentUser(null);
        setActiveRole('PUBLIC');
      }
    } catch (err) {
      console.warn('Session expired or unauthorized:', err);
      localStorage.removeItem('civictrust_token');
      setCurrentUser(null);
      setActiveRole('PUBLIC');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.login(username, password);
      localStorage.setItem('civictrust_token', data.access_token);
      setToken(data.access_token);
      await refreshUser();
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    setIsLoading(true);
    try {
      await api.register(userData);
      // Auto-login upon successful registration
      const data = await api.login(userData.username, userData.password);
      localStorage.setItem('civictrust_token', data.access_token);
      setToken(data.access_token);
      await refreshUser();
      setIsAuthModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.logout().catch(() => {});
    localStorage.removeItem('civictrust_token');
    setToken(null);
    setCurrentUser(null);
    setActiveRole('PUBLIC');
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        isVerificationModalOpen,
        setIsVerificationModalOpen,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
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
