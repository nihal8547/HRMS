# Firebase 400 Bad Request Error Fix

## Error
```
POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=... 400 (Bad Request)
```

## What This Error Means

This error occurs when Firebase Authentication tries to look up account information but the request fails. This is typically caused by:

1. **API Key Restrictions** - Your Firebase API key may have restrictions that prevent it from being used
2. **Invalid API Key** - The API key might be incorrect, expired, or revoked
3. **Firebase Project Configuration** - The Firebase project might not be properly configured
4. **Network/CORS Issues** - Less common, but possible

## Solutions

### 1. Check Firebase Console - API Key Restrictions

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click on **General** tab
5. Scroll down to **Your apps** section
6. Find your web app and check the API key
7. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**
8. Find your API key and check:
   - **Application restrictions** - Should allow your domain or be unrestricted for development
   - **API restrictions** - Should include "Identity Toolkit API" or be unrestricted

### 2. Verify Firebase Configuration

Check that your `.env` file (if using) or `src/firebase/config.ts` has the correct values:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Enable Required APIs

Make sure these APIs are enabled in Google Cloud Console:
- **Identity Toolkit API** (required for Firebase Auth)
- **Cloud Firestore API** (required for database)
- **Cloud Storage API** (required for file storage)

### 4. Check Firebase Authentication Settings

1. Go to Firebase Console → **Authentication**
2. Make sure **Email/Password** provider is enabled
3. Check **Authorized domains** - your localhost should be included

### 5. Clear Browser Cache and Local Storage

Sometimes corrupted auth tokens can cause issues:
1. Clear browser cache
2. Clear localStorage: `localStorage.clear()` in browser console
3. Clear sessionStorage: `sessionStorage.clear()` in browser console

### 6. Regenerate API Key (if needed)

If the API key is compromised or has issues:
1. Go to Google Cloud Console → **APIs & Services** → **Credentials**
2. Create a new API key
3. Update your `.env` file or `config.ts` with the new key
4. Restart your dev server

## Current Error Handling

The code has been updated to:
- Catch and log Firebase API errors
- Continue functioning even if API errors occur (when possible)
- Provide helpful console warnings about potential issues

## Note

This error is typically a **configuration issue** rather than a code issue. The error handling improvements will help the app continue working, but you should fix the root cause in Firebase Console.

