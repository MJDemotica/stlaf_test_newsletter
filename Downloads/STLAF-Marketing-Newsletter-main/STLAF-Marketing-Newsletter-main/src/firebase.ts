//
// File: firebase.ts
// Author: Juan Dela Cruz
// Date: 2026-06-09
// Purpose: Initializes and exports Firebase app instance, Firestore database instance, Authentication, Google Auth provider, and Cloud Storage
//

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Extend window interface for typescript compiling safety
declare global {
  interface Window {
    __FIREBASE_CONFIG__?: {
      apiKey?: string;
      authDomain?: string;
      projectId?: string;
      storageBucket?: string;
      messagingSenderId?: string;
      appId?: string;
      databaseId?: string;
    };
  }
}

const firebaseConfig = {
  apiKey: window.__FIREBASE_CONFIG__?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: window.__FIREBASE_CONFIG__?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: window.__FIREBASE_CONFIG__?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: window.__FIREBASE_CONFIG__?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.__FIREBASE_CONFIG__?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: window.__FIREBASE_CONFIG__?.appId || import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize if we have the basics
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, window.__FIREBASE_CONFIG__?.databaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const isFirebaseConfigured = isConfigured;

// Using the same Firestore database for notifications
export const notificationsDb = db;


