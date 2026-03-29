# Firebase Passwordless Authentication Migration

This document outlines the architecture, flow, and migration strategy for moving the administrative authentication system from Supabase Auth to **Firebase Authentication (Passwordless Email Links)**.

---

## 🚀 Authentication Flow (Frontend + Backend)

### 1. The Login Flow (Frontend)
- The user accesses `/admin/login`.
- They enter their `@scaler.com` email address into the input field and click **"Send Magic Link"**.
- The `Login.jsx` component leverages `sendSignInLinkToEmail()` from the Firebase client SDK to dispatch a magic link.
- **Edge Case Prevention:** The email address is simultaneously saved to the browser's `localStorage` (key: `emailForSignIn`). This is a strict Firebase requirement to prevent session injection attacks if someone clicks a forwarded email link.

### 2. The Verification Flow (Frontend)
- The user clicks the link in their email and is securely routed back to `/admin/login`.
- Firebase invokes the `isSignInWithEmailLink` check upon component mount.
- If true, `Login.jsx` retrieves the stored email from `localStorage`.
  - *Edge Case:* If the user opened the link on a different device (where `localStorage` is empty), they will be automatically prompted via `window.prompt` to explicitly type their email again to verify intent.
- `signInWithEmailLink()` executes. The Firebase ID Token is securely saved inside the browser's indexedDB silently.
- A final frontend authorization check confirms if the verified email domain strictly ends with `@scaler.com`.
- They are redirected to `/admin/dashboard`.

### 3. The Dashboard Router Guard (Frontend)
- `AdminDashboard.jsx` handles state with `isAuthLoading` to ensure the screen stays in a secure loading state while Firebase establishes the persistence context.
- `onAuthStateChanged` is used to detect active sessions. 
- If a valid Firebase user exists and they pass the local whitelist check, a secondary API ping (`/auth/me`) fires to ensure the backend validates the token.

### 4. The Request Lifecycle (Backend)
- Each secure API request runs through `fetchWithAuth()` (`frontend/src/utils/apiAuth.js`), which dynamically retrieves the active ID token using `auth.currentUser.getIdToken()`.
- The `authenticateAdmin` middleware (`backend/auth.js`) extracts this Bearer JWT token.
- It parses and cryptographically verifies the token using the `firebase-admin` service account (`admin.auth().verifyIdToken()`).
- Strict domain validation executes again on the backend, ensuring backend route protection is airtight against manually signed, non-Scaler tokens.

---

## 🛠 Required Environment Setup

For this to work, you must provision Firebase configurations for both your Local workspace and your Production Pipeline (Railway).

**1. Frontend (`.env` or Railway Variables)**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**2. Backend (`.env` or Railway Variables)**
In the backend, Firebase requires a securely compressed Service Account payload:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```
*Note:* Ensure the JSON payload is compressed onto a single line without trailing spaces when pasting it into Railway's Environment Variables panel.

---

## 🔐 Migration Strategy for Legacy Users

Because the previous iteration used Supabase sessions managed via independent cookies/local persistence, you must forcefully invalidate those lingering sessions so that users don't break the new logic.

**Strategic Steps:**
1. **Force De-Auth (Implemented):** 
   - I have stripped out the `supabase` client entirely. All legacy Supabase tokens are currently useless in the backend. 
   - The backend `authenticateAdmin` middleware will now uniformly throw `401 Unauthorized` for anyone accessing an API with a Supabase token, silently bouncing them back to `/admin/login`.
   
2. **User Communication (Action Required):**
   - You should send a system-wide Slack or Email notice stating: *"The Support Center Admin Auth is migrating from Supabase to Firebase. You have been logged out. Please request a new magic link at the login screen."*
   
3. **Database Mapping:**
   - Because Magic Links operate statelessly via Firebase, you do not need to manually map UI users to structural Database users unless you have an `admin_users` table you want to sync. Currently, it strictly enforces the RBAC schema statically defined in `backend/auth.js`.

---

## ⚠️ Edge Cases Addressed

1. **Link Expired or Already Used:**
   - If a magic link is clicked twice or after expiration, Firebase throws a specific `auth/invalid-action-code` error. The UI properly catches this in `Login.jsx` and tells the user: *"Error processing the login link. It may have expired."*
2. **Cross-Device Login Protocol:**
   - Attempted cross-device logins naturally lose the `localStorage` email anchor. `Login.jsx` gracefully degrades to explicitly requesting the email again rather than crashing the authentication phase.
3. **Ghost Login / Bypassing Check:**
   - The double-layer defense mechanism (Frontend validation AND Backend Validation) ensures that even if a developer manually bypasses the React router by mutating their browser's token state, the NodeJS server will catch the invalid JWT and purge their access immediately.
