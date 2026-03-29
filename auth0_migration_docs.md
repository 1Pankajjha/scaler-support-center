# Auth0 Passwordless Migration Architecture

This document covers the architectural layout, implementation specifics, and environment configurations for the transition from Firebase Authentication to **Auth0 Passwordless (Email Magic Links)** for the Scaler Support Center Admin Panel.

---

## 🔑 Infrastructure & Security Flow

### 1. Frontend Integration (`@auth0/auth0-react`)
Auth0 manages the entire lifecycle of the token and handles the redirection security bounds effectively protecting against CSRF and injection attacks.

*   **Initialization:** The app is wrapped in `<Auth0Provider>` in `App.jsx`. It defines the root tenant `domain` and `clientId`, and mandates the browser intercepts redirects securely locally.
*   **The Login Handshake (`Login.jsx`):**
    *   The Admin types their `@scaler.com` email into the custom UI.
    *   The form fires `loginWithRedirect({ authorizationParams: { connection: 'email', login_hint: email } })`.
    *   This explicitly commands Auth0 to immediately engage the passwordless email magic link flow *without* showing the legacy password input screen.
    *   Auth0 natively handles prompting the user to check their email.
*   **The Verification Callback (`App.jsx` & `AdminDashboard.jsx`):**
    *   When the admin clicks the link in their email, they bounce into the `/admin/dashboard` route.
    *   `useAuth0()` intercepts the token payload seamlessly.
    *   A frontend check fires verifying the user email payload ends in `@scaler.com`. If not, `logout()` is immediately executed.
    *   The raw Auth0 JWT logic is snagged via `getAccessTokenSilently()` and pushed into the generic API engine `apiAuth.js`.

### 2. Backend Integration (`express-oauth2-jwt-bearer`)
The backend now operates entirely statelessly against Auth0's JSON Web Key Sets (JWKS), verifying cryptographic token signatures natively.

*   **Middleware Parsing (`auth.js`):**
    *   The `checkJwt` middleware downloads the Auth0 tenant's public keys (`issuerBaseURL`) and validates the JWT against the specified `audience`.
*   **Strict RBAC Engine:**
    *   Auth0 access tokens typically don't carry the raw email payload by default to save space. We defensively check for `payload['https://scaler.com/email']`, `payload.email`, or fallback to sub claims.
    *   **Crucial Step:** To empower absolute server-side security, you *must* create an Auth0 Post-Login Action that binds the user's email to the custom claim: `https://scaler.com/email`.
    *   If the email claim passes the domain validation (`@scaler.com`), the backend maps their role and proceeds.

---

## 🛠️ Environment Configuration (Auth0)

You must explicitly configure your environment variables both Locally and in Railway to bind the codebase to your Auth0 tenant.

### Frontend Configuration (`frontend/.env` & Railway)
```env
# Your Auth0 Tenant Domain (e.g., dev-xxx.us.auth0.com)
VITE_AUTH0_DOMAIN=your_auth0_tenant_domain

# Your Auth0 SPA Application Client ID
VITE_AUTH0_CLIENT_ID=your_auth0_client_id
```

### Backend Configuration (`backend/.env` & Railway)
```env
# Your Auth0 Tenant Domain (e.g., dev-xxx.us.auth0.com)
AUTH0_DOMAIN=your_auth0_tenant_domain

# Your API Identifier (Configured in Auth0 APIs)
AUTH0_AUDIENCE=your_auth0_api_audience
```

---

## 🚀 Setting Up the Auth0 Dashboard

To make this implementation completely functional, configure the Auth0 console with the exact routing parameters:

1.  **Configure the SPA Client:**
    *   Go to **Applications** -> Create a **Single Page Web Application**.
    *   In Settings, set **Allowed Callback URLs**: 
        *   `http://localhost:5176/admin/dashboard`
        *   `https://scaler-support-center-production.up.railway.app/admin/dashboard`
    *   Set **Allowed Logout URLs**: 
        *   `http://localhost:5176/admin/login`
        *   `https://scaler-support-center-production.up.railway.app/admin/login`
    *   Set **Allowed Web Origins** & **Allowed Origins (CORS)** to mirror the root domains.

2.  **Enable Passwordless Connection:**
    *   Go to **Authentication** -> **Passwordless**.
    *   Toggle **Email**. Set the "From" address and create a simple Magic link template.
    *   Ensure this connection is explicitly enabled for your Single Page Application under the "Applications" tab within the Passwordless configuration.

3.  **Setup the API Audience:**
    *   Go to **Applications** -> **APIs**.
    *   Create an API (e.g., `https://api.scaler-support.com`). Use this string as your `AUTH0_AUDIENCE`.

4.  **Inject the Email Claim (Mandatory for Backend RBAC):**
    *   Go to **Actions** -> **Library** -> Build Custom Action.
    *   Add this script to inject the email so the backend can run the whitelist check:
        ```javascript
        exports.onExecutePostLogin = async (event, api) => {
          if (event.user.email) {
            api.accessToken.setCustomClaim('https://scaler.com/email', event.user.email);
          }
        };
        ```
    *   Deploy this action and attach it to the **Login** flow.

---

## ⚠️ Edge Cases Handled

1.  **Token Synchronization:** Because generic API files can't use React Hooks, I created an injector array (`setAuthToken`) inside `apiAuth.js`. `AdminDashboard.jsx` fetches the token contextually and updates the hook silently.
2.  **Legacy Session Conflict:** Auth0 completely ignores any legacy `localStorage` or cookie blobs created by Supabase or Firebase. Because `.env` variables have also been stripped, the old systems are completely isolated and fully decommissioned.
