# Authentication

## How it works

The IT dashboard is protected by Microsoft Entra ID (Azure AD) SSO via NextAuth v5. Staff log in with their Armstrong Microsoft accounts — no separate user accounts or passwords are stored in this app.

Public routes that require no login:
- `/request` — self-service access request form
- `/api/webhooks/zammad` — Zammad webhook (protected by HMAC instead)
- `/api/auth/*` — NextAuth endpoints
- `/login` — login page

Everything else (`/dashboard`, `/dashboard/settings`, `/dashboard/analytics`, `/dashboard/tickets/*`) redirects to `/login` if not authenticated. This is enforced in `src/proxy.ts`.

---

## Dev mode login

When `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, and `AZURE_AD_ISSUER` are all empty (the default after cloning), the app automatically switches to a dev-only credentials login. You'll see an amber "Dev mode — Azure AD not configured" banner on the login page.

**How to use it:**
1. Go to `http://localhost:3000/login`
2. Enter any email address (e.g. `cisco@goarmstrong.com`)
3. Enter any password (it's not checked — just needs to be non-empty)
4. Click "Sign in (dev)"

You'll be logged in with that email as your session identity.

**Dev mode only activates when:**
- `NODE_ENV=development` (i.e., running `npm run dev`)
- At least one of the Azure AD env vars is empty

Dev mode is completely disabled in production builds (`npm run build && npm start`) even if env vars are missing.

---

## Getting rid of dev mode (switching to real Microsoft SSO)

Dev mode disappears automatically the moment you fill in all three Azure AD env vars. There is no code to change — it's purely env-var-driven.

### Step 1 — Create an Azure AD app registration

1. Go to [portal.azure.com](https://portal.azure.com)
2. Search for **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in:
   - **Name:** `Armstrong Helpdesk`
   - **Supported account types:** Accounts in this organizational directory only (single tenant)
   - **Redirect URI:** Web → `https://helpdesk.goarmstrong.com/api/auth/callback/microsoft-entra-id`
4. Click **Register**

### Step 2 — Copy the IDs you need

On the app registration overview page:
- Copy **Application (client) ID** → this is `AZURE_AD_CLIENT_ID`
- Copy **Directory (tenant) ID** → you'll use this to build `AZURE_AD_ISSUER`

### Step 3 — Create a client secret

1. In the left menu, click **Certificates & secrets**
2. Click **New client secret**
3. Give it a description (e.g. "Helpdesk App") and choose an expiry (24 months recommended)
4. Click **Add**
5. **Copy the value immediately** — it's only shown once
6. This is `AZURE_AD_CLIENT_SECRET`

### Step 4 — Add a redirect URI for local dev (optional but recommended)

1. In the left menu, click **Authentication**
2. Under **Web → Redirect URIs**, click **Add URI**
3. Add: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
4. Click **Save**

This lets you test with real Azure AD locally without needing the production URL.

### Step 5 — Fill in .env

Open `.env` and set these four values:

```bash
AUTH_SECRET="<run: openssl rand -base64 32>"
AZURE_AD_CLIENT_ID="<Application (client) ID from step 2>"
AZURE_AD_CLIENT_SECRET="<client secret value from step 3>"
AZURE_AD_ISSUER="https://login.microsoftonline.com/<Directory (tenant) ID from step 2>/v2.0"
```

Example issuer: `https://login.microsoftonline.com/a1b2c3d4-1234-5678-abcd-000000000000/v2.0`

### Step 6 — Restart the dev server

```bash
# Stop the running server (Ctrl+C or kill the process), then:
npm run dev
```

Go to `http://localhost:3000/login` — you should now see a "Sign in with Microsoft" button instead of the dev form. Click it and you'll be redirected to Microsoft's OAuth login.

### Step 7 — Verify who can log in

By default, any user in your Azure AD tenant (anyone with an `@goarmstrong.com` Microsoft account) can log in. If you want to restrict it further (e.g. only IT team members), you can:

**Option A — App role assignment (recommended)**
1. In the Azure portal, go to the app registration → **Enterprise applications** → find your app
2. Under **Properties**, set **Assignment required** to Yes
3. Under **Users and groups**, add only the IT staff who should have access

**Option B — Check email domain in the session callback**

In `src/lib/auth.ts`, add a check in the `signIn` callback:

```typescript
callbacks: {
  async signIn({ user }) {
    return user.email?.endsWith("@goarmstrong.com") ?? false;
  },
  async session({ session, token }) {
    if (token?.email) session.user.email = token.email as string;
    return session;
  },
},
```

---

## Deploying to production

For production, set all env vars in your hosting platform (Vercel, Docker, etc.) — not in `.env` (which is gitignored and machine-local).

For Vercel:
1. Go to your project → Settings → Environment Variables
2. Add `AUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_ISSUER`
3. Redeploy

Make sure `AUTH_URL` is set to your production domain:

```bash
AUTH_URL="https://helpdesk.goarmstrong.com"
```

NextAuth uses this to build the callback URL. Without it, OAuth redirects may fail in production.

---

## Session details

- Sessions are JWT-based (stored in a cookie, not the database)
- Session cookie is signed with `AUTH_SECRET` — if you rotate this secret, all existing sessions are invalidated
- Session expiry follows NextAuth defaults (30 days)
- The user's email is available in server components via `const session = await auth()` → `session.user.email`

---

## Troubleshooting

**"Server error — There is a problem with the server configuration"**
Azure AD env vars are set but incorrect, or `AUTH_SECRET` is empty. Double-check all four values and restart the server.

**Redirect URI mismatch error from Microsoft**
The callback URL the app sends doesn't match what's registered in Azure. Make sure the redirect URI in Azure matches exactly:
- Production: `https://helpdesk.goarmstrong.com/api/auth/callback/microsoft-entra-id`
- Local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`

**Login works but session immediately expires**
`AUTH_SECRET` is different between restarts (e.g. regenerated each deploy). Set it once and keep it fixed.

**Dev mode login still showing even after filling in Azure vars**
Restart the dev server — env vars are loaded at startup. If it still shows, check that all three (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_ISSUER`) are non-empty.
