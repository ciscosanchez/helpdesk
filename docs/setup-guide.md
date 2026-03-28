# Setup Guide

Complete walkthrough to get the helpdesk app running.

---

## Current state (this machine)

Already done — no action needed:

| Step | Status |
|---|---|
| PostgreSQL 16 installed | Done (via Homebrew) |
| Database created | Done — `armstrong_helpdesk` on `localhost:5432` |
| Prisma client generated | Done — `npx prisma generate` was run |
| Database tables created | Done — `triaged_tickets`, `access_requests`, `kb_articles` |
| `.env` configured | Partial — `DATABASE_URL` set, API keys still need filling in |

**To run right now:**
```bash
# Fill in the remaining keys in .env, then:
npm run dev
```

The remaining keys you need before the app is fully functional:

| Key | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/api-keys](https://console.anthropic.com/settings/api-keys) |
| `ZAMMAD_URL` + `ZAMMAD_TOKEN` | Your Zammad instance — see [Zammad Configuration](zammad-configuration.md) |
| `ZAMMAD_WEBHOOK_SECRET` | Any random string — must match what you set in Zammad |
| `RESEND_API_KEY` | [resend.com](https://resend.com) — needs a verified sending domain |
| `AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `AZURE_AD_*` | Azure AD app registration — see Microsoft SSO section below |

---

## Setting up on a new machine

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted — Supabase, Neon, and Railway all work)
- A Zammad instance with admin access
- An Anthropic API key
- A Resend account with a verified sender domain
- Microsoft Azure AD app registration (for SSO)

### Step 1 — Clone and install

```bash
git clone git@github.com:ciscosanchez/helpdesk.git
cd helpdesk
npm install
```

### Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value. See the sections below for how to get each one.

### Step 3 — Set up the database

```bash
# Create the database
createdb armstrong_helpdesk

# Generate Prisma client (must run before starting the app)
npx prisma generate

# Create all tables
npx prisma db push
```

> **Prisma 7 note:** This project uses Prisma 7. The `DATABASE_URL` is read from `.env` via `prisma.config.ts` — it is intentionally not in `prisma/schema.prisma`. If you see a datasource validation error, make sure your `.env` file exists and `DATABASE_URL` is set before running Prisma commands.

To verify tables were created:
```bash
npx prisma studio
```
Opens a browser UI at `localhost:5555` to browse the database.

### Step 4 — Configure Zammad

See [zammad-configuration.md](zammad-configuration.md) for step-by-step Zammad setup. In summary:

1. Add 5 postmaster filters to block junk emails
2. Add 5 custom ticket fields (`ai_category`, `ai_priority`, `ai_confidence`, `ai_draft`, `ai_reviewed`)
3. Create a webhook pointing to your app's `/api/webhooks/zammad`
4. Create a trigger to fire the webhook on new ticket
5. (Optional) Install the redesigned email templates

### Step 5 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/dashboard` and prompted to log in with Microsoft.

To test the webhook locally, expose your local port with [ngrok](https://ngrok.com):
```bash
ngrok http 3000
```
Then set your Zammad webhook URL to: `https://xxxx.ngrok.io/api/webhooks/zammad`

---

## Environment variable reference

### Database
```
DATABASE_URL="postgresql://username@localhost:5432/armstrong_helpdesk"
```
On the local dev machine this is already set to `postgresql://cisco.sanchez@localhost:5432/armstrong_helpdesk`. For production, use a hosted PostgreSQL URL (Supabase, Neon, Railway, or your own server).

### Zammad
```
ZAMMAD_URL="https://your-zammad-instance.com"
ZAMMAD_TOKEN="your-zammad-api-token"
ZAMMAD_WEBHOOK_SECRET="random-secret-string"
```

**Getting a Zammad API token:**
1. Log in to Zammad as admin
2. Click your avatar → Profile → Token Access
3. Click "Create" — name it "Helpdesk App"
4. Required permission: `ticket.agent`
5. Copy the token (shown only once)

**ZAMMAD_WEBHOOK_SECRET:** Any long random string. Must be identical in both `.env` and Zammad's webhook configuration. Generate one:
```bash
openssl rand -hex 32
```

### Anthropic
```
ANTHROPIC_API_KEY="sk-ant-..."
```
Get from [console.anthropic.com/settings/api-keys](https://console.anthropic.com/settings/api-keys). The app uses `claude-sonnet-4-6`.

### Resend
```
RESEND_API_KEY="re_..."
RESEND_FROM="IT Helpdesk <helpdesk@goarmstrong.com>"
```
1. Sign up at [resend.com](https://resend.com)
2. Add and verify `goarmstrong.com` as a sending domain (requires adding DNS records)
3. Create an API key with "Full access"
4. The `RESEND_FROM` address must be on your verified domain

### Microsoft SSO
```
AUTH_SECRET="..."
AUTH_URL="https://helpdesk.goarmstrong.com"
AZURE_AD_CLIENT_ID="..."
AZURE_AD_CLIENT_SECRET="..."
AZURE_AD_ISSUER="https://login.microsoftonline.com/{tenant-id}/v2.0"
```

**Setting up the Azure AD app:**
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App Registrations
2. Click "New Registration"
   - Name: `Armstrong Helpdesk`
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `https://helpdesk.goarmstrong.com/api/auth/callback/microsoft-entra-id`
3. Copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`
4. Copy the **Directory (tenant) ID** → insert into `AZURE_AD_ISSUER`
5. Go to Certificates & Secrets → New Client Secret → copy the value → `AZURE_AD_CLIENT_SECRET`
6. Generate `AUTH_SECRET`: `openssl rand -base64 32`

For local dev, add a second redirect URI in Azure: `http://localhost:3000/api/auth/callback/microsoft-entra-id`

---

## Deploying to production

### Option A: Vercel (easiest)

```bash
npm install -g vercel
vercel
```

Vercel auto-detects Next.js. After the first deploy:
1. Go to your project in the Vercel dashboard → Settings → Environment Variables
2. Add all variables from `.env`
3. Redeploy

Set a custom domain under Settings → Domains: `helpdesk.goarmstrong.com`

> **Database for Vercel:** Vercel can't reach `localhost`. Use a hosted PostgreSQL — [Neon](https://neon.tech) has a free tier and takes under 2 minutes to set up. Update `DATABASE_URL` in Vercel's env vars to the Neon connection string.

### Option B: Docker + any VPS

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t armstrong-helpdesk .
docker run -p 3000:3000 --env-file .env armstrong-helpdesk
```

### Option C: PM2 on a server

```bash
npm run build
pm2 start npm --name "helpdesk" -- start
```

---

## After deploying — point Zammad at production

Update your Zammad webhook URL from ngrok to the production address:
- Zammad Admin → Manage → Webhooks → edit "Helpdesk AI Triage"
- Endpoint: `https://helpdesk.goarmstrong.com/api/webhooks/zammad`

---

## Verifying everything works

1. Send a test email to your Zammad helpdesk inbox
2. Wait ~10 seconds
3. Open the ticket in Zammad — you should see an internal note starting with "🤖 AI Triage Result" and an `ai:category` tag
4. Open `localhost:3000/dashboard` (or your production URL) — the ticket should appear with category, priority, and draft reply

**Nothing happening?**
- Is the Zammad trigger active and pointing to the right URL?
- Is `ZAMMAD_WEBHOOK_SECRET` identical in both `.env` and Zammad's webhook config?
- Check server logs for `[webhook/zammad]` entries or errors
- Confirm `ANTHROPIC_API_KEY` is set and valid

---

## Sharing the self-service form

The access request form at `/request` requires no login. Share this link everywhere:

```
https://helpdesk.goarmstrong.com/request
```

Good places to link it:
- IT team email signatures: "Need system access? [Skip the email →](https://helpdesk.goarmstrong.com/request)"
- The customer acknowledgment trigger email (already included in the template)
- Armstrong intranet / Bookstack wiki IT page
- New employee onboarding checklist
