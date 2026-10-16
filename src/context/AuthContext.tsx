import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  calculateSubscriptionExpiration,
  fetchCustomerSubscriptionFromSupabase,
  normalizePhoneNumber
} from '../lib/supabase.ts';

export interface UserPayment {
  orderId: string;
  phone: string;
  amount: number;
  planId: string;
  planName: string;
  durationDays: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface UserData {
  phone: string;
  createdDate: string;
  lastActive: string;
  trialSecondsUsed: number;
  trialCompleted: boolean;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  hasActiveSubscription: boolean;
  payments: UserPayment[];
}

interface AuthContextType {
  user: UserData | null;
  phone: string;
  isLoggedIn: boolean;
  hasActiveSubscription: boolean;
  trialRemainingSeconds: number;
  trialCompleted: boolean;
  lowBandwidthMode: boolean;
  isLoginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  setLowBandwidthMode: (enabled: boolean) => void;
  login: (phone: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  recordTrialSecondWatched: () => Promise<void>;
  updateUserSubscriptionLocally: (planName: string, days: number, orderId?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_PHONE_KEY = 'yourmaxtv_current_phone';
const LOCAL_STORAGE_USERS_CACHE = 'yourmaxtv_user_cache_';
const LOCAL_STORAGE_DATA_SAVER = 'yourmaxtv_data_saver';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phone, setPhone] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_PHONE_KEY) || '';
  });

  const [user, setUser] = useState<UserData | null>(null);
  const [trialRemainingSeconds, setTrialRemainingSeconds] = useState<number>(60);
  const [trialCompleted, setTrialCompleted] = useState<boolean>(false);
  const [lowBandwidthMode, setLowBandwidthModeState] = useState<boolean>(() => {
    return localStorage.getItem(LOCAL_STORAGE_DATA_SAVER) === 'true';
  });
  const [isLoginModalOpen, setLoginModalOpen] = useState<boolean>(false);

  const setLowBandwidthMode = (enabled: boolean) => {
    setLowBandwidthModeState(enabled);
    localStorage.setItem(LOCAL_STORAGE_DATA_SAVER, enabled ? 'true' : 'false');
  };

  // Sync cache for the phone
  const loadUserFromLocal = (targetPhone: string): UserData | null => {
    try {
      const cached = localStorage.getItem(`${LOCAL_STORAGE_USERS_CACHE}${targetPhone}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse local user cache', e);
    }
    return null;
  };

  const saveUserToLocal = (userData: UserData) => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_USERS_CACHE}${userData.phone}`, JSON.stringify(userData));
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
  };

  const syncUserData = (userData: UserData) => {
    setUser(userData);
    const hasActive = Boolean(
      userData.isSubscribed &&
      userData.subscriptionExpiresAt &&
      new Date(userData.subscriptionExpiresAt).getTime() > Date.now()
    );
    userData.hasActiveSubscription = hasActive;

    const remaining = Math.max(0, 60 - (userData.trialSecondsUsed || 0));
    setTrialRemainingSeconds(hasActive ? 60 : remaining);
    setTrialCompleted(hasActive ? false : (userData.trialCompleted || remaining <= 0));
    saveUserToLocal(userData);
  };

  const login = async (inputPhone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: inputPhone, deviceInfo: navigator.userAgent })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setPhone(data.user.phone);
        localStorage.setItem(LOCAL_STORAGE_PHONE_KEY, data.user.phone);
        syncUserData(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || 'Imeshindikana kuingia. Jaribu tena.' };
    } catch (err: any) {
      // Fallback offline / local login
      const clean = inputPhone.replace(/\D/g, '');
      const offlineUser: UserData = loadUserFromLocal(clean) || {
        phone: clean,
        createdDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        trialSecondsUsed: 0,
        trialCompleted: false,
        isSubscribed: false,
        hasActiveSubscription: false,
        payments: []
      };
      setPhone(clean);
      localStorage.setItem(LOCAL_STORAGE_PHONE_KEY, clean);
      syncUserData(offlineUser);
      return { success: true };
    }
  };

  const logout = () => {
    setPhone('');
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_PHONE_KEY);
    setTrialRemainingSeconds(60);
    setTrialCompleted(false);
  };

  const refreshProfile = async () => {
    if (!phone) return;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success && data.user) {
        syncUserData(data.user);
      }
    } catch (e) {
      console.warn('Profile refresh fallback', e);
    }
  };

  const recordTrialSecondWatched = async () => {
    if (!phone) return;
    if (user?.hasActiveSubscription) return;
    if (trialCompleted) return;

    const newRemaining = Math.max(0, trialRemainingSeconds - 1);
    setTrialRemainingSeconds(newRemaining);
    if (newRemaining <= 0) {
      setTrialCompleted(true);
    }

    try {
      const res = await fetch('/api/auth/update-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, secondsWatched: 1 })
      });
      const data = await res.json();
      if (data.success) {
        if (data.hasActiveSubscription) {
          if (user) {
            user.isSubscribed = true;
            user.hasActiveSubscription = true;
            syncUserData(user);
          }
        } else {
          setTrialRemainingSeconds(data.trialRemainingSeconds);
          setTrialCompleted(data.trialCompleted);
          if (user) {
            user.trialSecondsUsed = data.trialSecondsUsed;
            user.trialCompleted = data.trialCompleted;
            saveUserToLocal(user);
          }
        }
      }
    } catch (e) {
      // Local decrement
      if (user) {
        user.trialSecondsUsed = (user.trialSecondsUsed || 0) + 1;
        if (user.trialSecondsUsed >= 60) {
          user.trialCompleted = true;
          setTrialCompleted(true);
        }
        saveUserToLocal(user);
      }
    }
  };

  const updateUserSubscriptionLocally = (planName: string, days: number, orderId?: string) => {
    if (!user && !phone) return;
    const currentPhone = phone || (user ? user.phone : '0712345678');
    const existing = user || {
      phone: currentPhone,
      createdDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      trialSecondsUsed: 60,
      trialCompleted: true,
      isSubscribed: true,
      hasActiveSubscription: true,
      payments: []
    };

    const now = new Date();
    const currentExpiry = existing.subscriptionExpiresAt && new Date(existing.subscriptionExpiresAt).getTime() > now.getTime()
      ? new Date(existing.subscriptionExpiresAt)
      : now;
    const amount = days === 30 ? 10000 : days === 7 ? 3000 : 1000;
    const calculated = calculateSubscriptionExpiration(amount, currentExpiry);
    const newExpiry = calculated.toISOString();

    const updatedUser: UserData = {
      ...existing,
      isSubscribed: true,
      hasActiveSubscription: true,
      subscriptionPlan: planName,
      subscriptionExpiresAt: newExpiry,
      trialCompleted: true,
      payments: [
        ...(existing.payments || []),
        {
          orderId: orderId || `HP${Date.now()}`,
          phone: currentPhone,
          amount: days === 2 ? 1000 : days === 7 ? 3000 : 10000,
          planId: days === 2 ? 'plan_2days' : days === 7 ? 'plan_7days' : 'plan_30days',
          planName: planName,
          durationDays: days,
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        }
      ]
    };

    syncUserData(updatedUser);
  };

  useEffect(() => {
    if (phone) {
      // Try local cache first for instant UI response
      const local = loadUserFromLocal(phone);
      if (local) {
        syncUserData(local);
      }
      refreshProfile();
    }
  }, [phone]);

  const hasActiveSubscription = Boolean(user && user.hasActiveSubscription);

  return (
    <AuthContext.Provider
      value={{
        user,
        phone,
        isLoggedIn: Boolean(phone),
        hasActiveSubscription,
        trialRemainingSeconds,
        trialCompleted,
        lowBandwidthMode,
        isLoginModalOpen,
        setLoginModalOpen,
        setLowBandwidthMode,
        login,
        logout,
        refreshProfile,
        recordTrialSecondWatched,
        updateUserSubscriptionLocally
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
