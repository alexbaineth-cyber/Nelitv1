import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyC3eR88QL3bvv03Z502bOzx0cOKbB0ieeE",
  authDomain: "neliplay.firebaseapp.com",
  databaseURL: "https://neliplay-default-rtdb.firebaseio.com",
  projectId: "neliplay",
  storageBucket: "neliplay.firebasestorage.app",
  messagingSenderId: "39702563643",
  appId: "1:39702563643:web:0f3bd21d7f9eebf283051e",
  measurementId: "G-X6PTFVYN1H"
};

// Initialize Firebase safely (avoid duplicate app initialization)
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Signs in with Google using popup, with automatic fallback to redirect on mobile or restrictive browsers
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    return result.user;
  } catch (error: any) {
    // If popup was blocked or closed by user on mobile/iFrame, fallback to redirect
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(firebaseAuth, googleProvider);
      const redirectResult = await getRedirectResult(firebaseAuth);
      if (redirectResult && redirectResult.user) {
        return redirectResult.user;
      }
    }
    throw error;
  }
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, pass);
  return cred.user;
}

/**
 * Sign up with Email and Password
 */
export async function signUpWithEmail(email: string, pass: string, displayName?: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, pass);
  if (displayName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch {}
  }
  return cred.user;
}

/**
 * Sign out
 */
export async function logoutFirebase(): Promise<void> {
  await signOut(firebaseAuth);
}

export type { User };
