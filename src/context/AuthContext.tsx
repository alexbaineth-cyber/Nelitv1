import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  firebaseAuth,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  logoutFirebase,
  User as FirebaseUser
} from '../lib/firebase.ts';
import {
  calculateSubscriptionExpiration,
  fetchCustomerSubscriptionFromSupabase,
  normalizePhoneNumber,
  isSubscriptionActive
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
  id?: string;
  uid?: string;
  phone: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  authProvider?: 'phone' | 'google' | 'email';
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
  firebaseUser: FirebaseUser | null;
  phone: string;
  email: string;
  displayName: string;
  photoURL: string;
  isLoggedIn: boolean;
  hasActiveSubscription: boolean;
  trialRemainingSeconds: number;
  trialCompleted: boolean;
  lowBandwidthMode: boolean;
  isLoginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  setLowBandwidthMode: (enabled: boolean) => void;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmailAndPassword: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmailAndPassword: (email: string, pass: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  recordTrialSecondWatched: () => Promise<void>;
  updateUserSubscriptionLocally: (planName: string, days: number, orderId?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'nelitv_user_profile';
const LOCAL_STORAGE_PHONE_KEY = 'nelitv_current_phone';
const LOCAL_STORAGE_DATA_SAVER = 'nelitv_data_saver';

const LOCAL_STORAGE_TRIAL_SECONDS = 'nelitv_trial_seconds_left';
const LOCAL_STORAGE_TRIAL_DONE = 'nelitv_trial_completed';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [phone, setPhone] = useState<string>(() => localStorage.getItem(LOCAL_STORAGE_PHONE_KEY) || '');
  const [user, setUser] = useState<UserData | null>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Persistent trial tracking: prevents timer from restarting upon reload/refresh!
  const [trialRemainingSeconds, setTrialRemainingSeconds] = useState<number>(() => {
    try {
      if (localStorage.getItem(LOCAL_STORAGE_TRIAL_DONE) === 'true') {
        return 0;
      }
      const saved = localStorage.getItem(LOCAL_STORAGE_TRIAL_SECONDS);
      if (saved !== null) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? 60 : Math.max(0, Math.min(60, val));
      }
      const userStored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (userStored) {
        const u = JSON.parse(userStored);
        if (u.trialCompleted) return 0;
        if (typeof u.trialSecondsUsed === 'number') {
          return Math.max(0, 60 - u.trialSecondsUsed);
        }
      }
    } catch {}
    return 60;
  });

  const [trialCompleted, setTrialCompleted] = useState<boolean>(() => {
    try {
      if (localStorage.getItem(LOCAL_STORAGE_TRIAL_DONE) === 'true') {
        return true;
      }
      const saved = localStorage.getItem(LOCAL_STORAGE_TRIAL_SECONDS);
      if (saved !== null && parseInt(saved, 10) <= 0) {
        return true;
      }
      const userStored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (userStored) {
        const u = JSON.parse(userStored);
        if (u.trialCompleted || (typeof u.trialSecondsUsed === 'number' && u.trialSecondsUsed >= 60)) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  const [lowBandwidthMode, setLowBandwidthModeState] = useState<boolean>(() => {
    return localStorage.getItem(LOCAL_STORAGE_DATA_SAVER) === 'true';
  });
  const [isLoginModalOpen, setLoginModalOpen] = useState<boolean>(false);

  const setLowBandwidthMode = (enabled: boolean) => {
    setLowBandwidthModeState(enabled);
    localStorage.setItem(LOCAL_STORAGE_DATA_SAVER, enabled ? 'true' : 'false');
  };

  const syncUserData = (userData: UserData) => {
    setUser(userData);
    const hasActive = Boolean(
      userData.isSubscribed &&
      userData.subscriptionExpiresAt &&
      new Date(userData.subscriptionExpiresAt).getTime() > Date.now()
    );
    userData.hasActiveSubscription = hasActive;

    if (hasActive) {
      setTrialRemainingSeconds(60);
      setTrialCompleted(false);
      try {
        localStorage.removeItem(LOCAL_STORAGE_TRIAL_DONE);
        localStorage.setItem(LOCAL_STORAGE_TRIAL_SECONDS, '60');
      } catch {}
    } else {
      let remaining = 60;
      const saved = localStorage.getItem(LOCAL_STORAGE_TRIAL_SECONDS);
      if (saved !== null) {
        remaining = Math.max(0, parseInt(saved, 10) || 0);
      } else if (typeof userData.trialSecondsUsed === 'number') {
        remaining = Math.max(0, 60 - userData.trialSecondsUsed);
      }
      const isDone = userData.trialCompleted || remaining <= 0 || localStorage.getItem(LOCAL_STORAGE_TRIAL_DONE) === 'true';
      setTrialRemainingSeconds(isDone ? 0 : remaining);
      setTrialCompleted(isDone);
      if (isDone) {
        try {
          localStorage.setItem(LOCAL_STORAGE_TRIAL_DONE, 'true');
          localStorage.setItem(LOCAL_STORAGE_TRIAL_SECONDS, '0');
        } catch {}
      }
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userData));
      if (userData.phone) {
        localStorage.setItem(LOCAL_STORAGE_PHONE_KEY, userData.phone);
      }
    } catch {}
  };

  // Check Supabase subscription status for an identifier (phone or email)
  const syncWithSupabase = async (identifier: string, currentUserData: UserData): Promise<UserData> => {
    try {
      const sub = await fetchCustomerSubscriptionFromSupabase(identifier);
      if (sub && isSubscriptionActive(sub)) {
        return {
          ...currentUserData,
          isSubscribed: true,
          hasActiveSubscription: true,
          subscriptionExpiresAt: sub.expires_at,
          subscriptionPlan: sub.plan_name || 'Kifurushi Hai',
          trialCompleted: false,
          trialSecondsUsed: 0
        };
      }
    } catch (e) {
      console.warn('Supabase profile sync note:', e);
    }
    return currentUserData;
  };

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const userEmail = fbUser.email || '';
        const userDisplayName = fbUser.displayName || userEmail.split('@')[0] || 'Tazamaji';
        const userPhoto = fbUser.photoURL || '';

        let baseUser: UserData = user || {
          uid: fbUser.uid,
          phone: phone || '',
          email: userEmail,
          displayName: userDisplayName,
          photoURL: userPhoto,
          authProvider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
          createdDate: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          trialSecondsUsed: 0,
          trialCompleted: false,
          isSubscribed: false,
          hasActiveSubscription: false,
          payments: []
        };

        baseUser = {
          ...baseUser,
          uid: fbUser.uid,
          email: userEmail,
          displayName: userDisplayName,
          photoURL: userPhoto,
          lastActive: new Date().toISOString()
        };

        // Check if there is an active subscription in Supabase via email or phone
        if (userEmail) {
          baseUser = await syncWithSupabase(userEmail, baseUser);
        }
        if (baseUser.phone) {
          baseUser = await syncWithSupabase(baseUser.phone, baseUser);
        }

        syncUserData(baseUser);
      }
    });

    return () => unsubscribe();
  }, [phone]);

  // Login with phone number
  const loginWithPhone = async (inputPhone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const clean = normalizePhoneNumber(inputPhone);
      setPhone(clean);
      localStorage.setItem(LOCAL_STORAGE_PHONE_KEY, clean);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, deviceInfo: navigator.userAgent })
      });
      const data = await res.json();
      if (data.success && data.user) {
        let synced = data.user;
        synced = await syncWithSupabase(clean, synced);
        syncUserData(synced);
        return { success: true };
      }
      return { success: false, error: data.error || 'Imeshindikana kuingia.' };
    } catch {
      const clean = normalizePhoneNumber(inputPhone);
      let localUser: UserData = {
        phone: clean,
        displayName: 'Mwanachama',
        authProvider: 'phone',
        createdDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        trialSecondsUsed: 0,
        trialCompleted: false,
        isSubscribed: false,
        hasActiveSubscription: false,
        payments: []
      };
      localUser = await syncWithSupabase(clean, localUser);
      syncUserData(localUser);
      return { success: true };
    }
  };

  // Login with Google
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const fbUser = await signInWithGoogle();
      const userEmail = fbUser.email || '';
      const userDisplayName = fbUser.displayName || 'Mwanachama';
      const userPhoto = fbUser.photoURL || '';

      let baseUser: UserData = {
        uid: fbUser.uid,
        phone: phone || '',
        email: userEmail,
        displayName: userDisplayName,
        photoURL: userPhoto,
        authProvider: 'google',
        createdDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        trialSecondsUsed: 0,
        trialCompleted: false,
        isSubscribed: false,
        hasActiveSubscription: false,
        payments: []
      };

      baseUser = await syncWithSupabase(userEmail, baseUser);
      if (phone) {
        baseUser = await syncWithSupabase(phone, baseUser);
      }

      syncUserData(baseUser);
      return { success: true };
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      let msg = 'Imeshindikana kuingia na Google.';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Ulifunga dirisha la kuingia Google.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Hitilafu ya mtandao. Angalia intaneti yako.';
      }
      return { success: false, error: msg };
    }
  };

  // Login with Email & Password
  const loginWithEmailAndPassword = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const fbUser = await signInWithEmail(email.trim(), pass);
      const userEmail = fbUser.email || email;
      const userDisplayName = fbUser.displayName || email.split('@')[0];

      let baseUser: UserData = {
        uid: fbUser.uid,
        phone: phone || '',
        email: userEmail,
        displayName: userDisplayName,
        authProvider: 'email',
        createdDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        trialSecondsUsed: 0,
        trialCompleted: false,
        isSubscribed: false,
        hasActiveSubscription: false,
        payments: []
      };

      baseUser = await syncWithSupabase(userEmail, baseUser);
      syncUserData(baseUser);
      return { success: true };
    } catch (err: any) {
      let msg = 'Barua pepe au nenosiri sio sahihi.';
      if (err.code === 'auth/user-not-found') msg = 'Akaunti hii haipo. Tafadhali Jisajili kwanza.';
      if (err.code === 'auth/wrong-password') msg = 'Nenosiri sio sahihi.';
      if (err.code === 'auth/invalid-email') msg = 'Muundo wa barua pepe sio sahihi.';
      return { success: false, error: msg };
    }
  };

  // Register with Email & Password
  const registerWithEmailAndPassword = async (email: string, pass: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const fbUser = await signUpWithEmail(email.trim(), pass, name);
      const userEmail = fbUser.email || email;
      const userDisplayName = name || fbUser.displayName || email.split('@')[0];

      const baseUser: UserData = {
        uid: fbUser.uid,
        phone: phone || '',
        email: userEmail,
        displayName: userDisplayName,
        authProvider: 'email',
        createdDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        trialSecondsUsed: 0,
        trialCompleted: false,
        isSubscribed: false,
        hasActiveSubscription: false,
        payments: []
      };

      syncUserData(baseUser);
      return { success: true };
    } catch (err: any) {
      let msg = 'Imeshindikana kusajili akaunti.';
      if (err.code === 'auth/email-already-in-use') msg = 'Barua pepe hii tayari inatumika. Tafadhali Ingia.';
      if (err.code === 'auth/weak-password') msg = 'Nenosiri lazima liwe na angalau herufi 6.';
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await logoutFirebase();
    } catch {}
    setPhone('');
    setUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    localStorage.removeItem(LOCAL_STORAGE_PHONE_KEY);
    setTrialRemainingSeconds(60);
    setTrialCompleted(false);
  };

  const refreshProfile = async () => {
    if (!phone && !user?.email) return;

    try {
      let updatedUser = user;
      if (phone) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success && data.user) {
          updatedUser = data.user;
        }
      }

      if (updatedUser) {
        if (phone) updatedUser = await syncWithSupabase(phone, updatedUser);
        if (updatedUser.email) updatedUser = await syncWithSupabase(updatedUser.email, updatedUser);
        syncUserData(updatedUser);
      }
    } catch (e) {
      console.warn('Profile refresh note:', e);
    }
  };

  const recordTrialSecondWatched = async () => {
    if (user?.hasActiveSubscription) return;
    if (trialCompleted) return;

    setTrialRemainingSeconds((prev) => {
      const newRemaining = Math.max(0, prev - 1);
      try {
        localStorage.setItem(LOCAL_STORAGE_TRIAL_SECONDS, String(newRemaining));
        if (newRemaining <= 0) {
          localStorage.setItem(LOCAL_STORAGE_TRIAL_DONE, 'true');
          setTrialCompleted(true);
        }
      } catch {}
      return newRemaining;
    });

    if (user) {
      user.trialSecondsUsed = Math.min(60, (user.trialSecondsUsed || 0) + 1);
      if (user.trialSecondsUsed >= 60) {
        user.trialCompleted = true;
        setTrialCompleted(true);
      }
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      } catch {}
    }

    if (phone) {
      try {
        const res = await fetch('/api/auth/update-trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, secondsWatched: 1 })
        });
        const data = await res.json();
        if (data.success) {
          if (data.hasActiveSubscription && user) {
            user.isSubscribed = true;
            user.hasActiveSubscription = true;
            syncUserData(user);
          } else {
            setTrialRemainingSeconds(data.trialRemainingSeconds);
            setTrialCompleted(data.trialCompleted);
            try {
              localStorage.setItem(LOCAL_STORAGE_TRIAL_SECONDS, String(data.trialRemainingSeconds));
              if (data.trialCompleted) {
                localStorage.setItem(LOCAL_STORAGE_TRIAL_DONE, 'true');
              }
            } catch {}
            if (user) {
              user.trialSecondsUsed = data.trialSecondsUsed;
              user.trialCompleted = data.trialCompleted;
              try {
                localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
              } catch {}
            }
          }
        }
      } catch {
        // Fallback already saved locally
      }
    }
  };

  const updateUserSubscriptionLocally = (planName: string, days: number, orderId?: string) => {
    const currentPhone = phone || user?.phone || '0712345678';
    const amount = days >= 30 ? 10000 : (days >= 7 ? 3000 : 1000);
    const existing = user || {
      phone: currentPhone,
      email: firebaseUser?.email || '',
      displayName: firebaseUser?.displayName || 'Mwanachama',
      createdDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      trialSecondsUsed: 60,
      trialCompleted: true,
      isSubscribed: true,
      hasActiveSubscription: true,
      payments: []
    };

    const newExpiry = calculateSubscriptionExpiration(amount);
    const newPayment: UserPayment = {
      orderId: orderId || `HP-${Date.now()}`,
      phone: currentPhone,
      amount,
      planId: days >= 30 ? 'plan_30days' : (days >= 7 ? 'plan_7days' : 'plan_2days'),
      planName,
      durationDays: days,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    const updatedUser: UserData = {
      ...existing,
      phone: currentPhone,
      isSubscribed: true,
      hasActiveSubscription: true,
      subscriptionPlan: planName,
      subscriptionExpiresAt: newExpiry.toISOString(),
      trialCompleted: true,
      payments: [newPayment, ...(existing.payments || [])]
    };

    syncUserData(updatedUser);
  };

  const isLoggedIn = Boolean(user && (user.phone || user.email || user.uid));
  const hasActiveSubscription = Boolean(
    user?.isSubscribed &&
    user?.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now()
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        phone: phone || user?.phone || '',
        email: user?.email || firebaseUser?.email || '',
        displayName: user?.displayName || firebaseUser?.displayName || (phone ? `Mtumiaji ${phone.slice(-4)}` : 'Mgeni'),
        photoURL: user?.photoURL || firebaseUser?.photoURL || '',
        isLoggedIn,
        hasActiveSubscription,
        trialRemainingSeconds,
        trialCompleted,
        lowBandwidthMode,
        isLoginModalOpen,
        setLoginModalOpen,
        setLowBandwidthMode,
        loginWithPhone,
        loginWithGoogle,
        loginWithEmailAndPassword,
        registerWithEmailAndPassword,
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
