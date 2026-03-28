# Setup Guide

Complete walkthrough to go from zero to a running helpdesk app.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted — Supabase, Neon, Railway all work)
- A Zammad instance with admin access
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- A Resend account and verified sender domain ([resend.com](https://resend.com))
- Microsoft Azure AD app registration (for SSO)

---

## Step 1 — Clone and install

```bash
git clone git@github.com:ciscosanchez/helpdesk.git
cd helpdesk
npm install
```

---

## Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

### Database
```
DATABASE_URL="postgresql://user:password@localhost:5432/armstrong_helpdesk"
```
Create the database first: `createdb armstrong_helpdesk`

### Zammad
```
ZAMMAD_URL="https://your-zammad-instance.com"
ZAMMAD_TOKEN="your-zammad-api-token"
ZAMMAD_WEBHOOK_SECRET="any-random-secret-you-choose"
```

**Getting a Zammad API token:**
1. Log in to Zammad as admin
2. Click your avatar → Profile → Token Access
3. Click "Create" — give it a name like "Helpdesk App"
4. Permissions needed: `ticket.agent`
5. Copy the token (shown only once)

**ZAMMAD_WEBHOOK_SECRET:** Pick any long random string. You'll enter the same value in Zammad's webhook config later. Generate one with:
```bash
openssl rand -hex 32
```

### Anthropic
```
ANTHROPIC_API_KEY="sk-ant-..."
```
Get this from [console.anthropic.com/settings/api-keys](https://console.anthropic.com/settings/api-keys)

### Resend
```
RESEND_API_KEY="re_..."
RESEND_FROM="IT Helpdesk <helpdesk@goarmstrong.com>"
```
1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain (goarmstrong.com)
3. Create an API key with "Full access"
4. The `RESEND_FROM` address must be on your verified domain

### Microsoft SSO
```
AUTH_SECRET="generate-with: openssl rand -base64 32"
AUTH_URL="https://helpdesk.goarmstrong.com"
AZURE_AD_CLIENT_ID="your-azure-app-client-id"
AZURE_AD_CLIENT_SECRET="your-azure-app-client-secret"
AZURE_AD_ISSUER="https://login.microsoftonline.com/your-tenant-id/v2.0"
```

**Setting up the Azure AD app:**
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App Registrations
2. Click "New Registration"
   - Name: `Armstrong Helpdesk`
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `https://helpdesk.goarmstrong.com/api/auth/callback/microsoft-entra-id`
3. After creation, copy the **Application (client) ID** → `AZURE_AD_CLIENT_ID`
4. Copy the **Directory (tenant) ID** → use in `AZURE_AD_ISSUER` URL
5. Go to Certificates & Secrets → New Client Secret
   - Copy the secret value → `AZURE_AD_CLIENT_SECRET`

For local dev, add `http://localhost:3000/api/auth/callback/microsoft-entra-id` as an additional redirect URI in Azure.

---

## Step 3 — Set up the database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push
```

To verify tables were created:
```bash
npx prisma studio
```
This opens a browser UI at `localhost:5555` where you can browse the database.

---

## Step 4 — Configure Zammad

See [docs/zammad-configuration.md](zammad-configuration.md) for the full Zammad setup. In summary:

1. Add 5 postmaster filters to block junk emails
2. Add 5 custom ticket fields (`ai_category`, `ai_priority`, `ai_confidence`, `ai_draft`, `ai_reviewed`)
3. Create a webhook pointing to `https://your-app.com/api/webhooks/zammad`
4. Create a trigger to fire the webhook on new ticket
5. (Optional) Install the redesigned email templates

---

## Step 5 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/dashboard` and prompted to log in with Microsoft.

To test the webhook locally, use [ngrok](https://ngrok.com) to expose your local port:
```bash
ngrok http 3000
```
Then set your Zammad webhook URL to the ngrok URL: `https://xxxx.ngrok.io/api/webhooks/zammad`

---

## Step 6 — Deploy to production

### Option A: Vercel (recommended — easiest)

```bash
npm install -g vercel
vercel
```

Vercel auto-detects Next.js. After first deploy:
1. Go to your project settings in Vercel → Environment Variables
2. Add all variables from `.env`
3. Redeploy

Your app will be live at `https://helpdesk-xyz.vercel.app` (or a custom domain).

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

## Step 7 — Point Zammad webhook at production URL

Once deployed, update your Zammad webhook URL from the ngrok address to your production URL:
- Zammad Admin → Manage → Webhooks → edit your webhook
- Set Endpoint to: `https://helpdesk.goarmstrong.com/api/webhooks/zammad`

---

## Verifying it works

1. In Zammad, create a test ticket manually (or send a test email)
2. Check your app's server logs — you should see `[webhook/zammad]` entries
3. The ticket should appear in your Zammad instance with an `ai:category` tag and an internal AI triage note
4. Check `localhost:3000/dashboard` — the ticket should appear there with Claude's analysis

If nothing happens, check:
- Is the Zammad trigger enabled and pointing to the right URL?
- Is `ZAMMAD_WEBHOOK_SECRET` the same in both `.env` and Zammad's webhook config?
- Are there any errors in the server console?

---

## Sharing the self-service form

The self-service access request form at `/request` is public — no login needed. Share this link:

```
https://helpdesk.goarmstrong.com/request
```

**Recommended places to link it:**
- Your IT email signature: "Need system access? Skip the email → [Request Access](https://helpdesk.goarmstrong.com/request)"
- Zammad's automatic acknowledgment email (see `zammad-templates/customer-ack-trigger-email.html`)
- Armstrong intranet/wiki homepage
- Onboarding materials for new employees
