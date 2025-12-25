import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB86plz_MB3849xz7XnaGxXHSmBv9_BzHE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-5211142753-42ffe.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-5211142753-42ffe",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-5211142753-42ffe.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "113546460196",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:113546460196:web:476a035ab02e495842ecb1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

