# Armstrong IT Helpdesk

AI-powered triage layer on top of Zammad for Armstrong Relocation & Companies IT team.

Built to cut ticket volume by 50–60% by auto-handling junk, auto-routing external vendor tickets, deflecting password resets and access requests to self-service, and giving IT staff AI-drafted replies for everything else.

---

## What it does

Every inbound ticket flows through Claude (claude-sonnet-4-6) the moment it arrives in Zammad. Within seconds, each ticket is:

- **Classified** into one of 10 categories (access request, password reset, hardware, security report, etc.)
- **Prioritized** on a 1–5 scale (executives automatically get P1)
- **Auto-handled** if it fits a known pattern — junk is closed, password resets get a self-service link, external vendor tickets get the right phone number, access requests get directed to the self-service form
- **Drafted** with a ready-to-send reply for everything that needs a human

IT staff open the dashboard, see what needs review, edit the draft if needed, and hit "Approve & Send." No copy-pasting, no looking up vendor phone numbers, no repeating the same answers.

---

## System components

| Component | Purpose |
|---|---|
| Zammad | Existing ticket system — receives emails, stores tickets |
| Webhook trigger | Fires when a new ticket is created → calls this app |
| Postmaster filters | Blocks junk emails from ever becoming tickets |
| `POST /api/webhooks/zammad` | Receives webhook, runs Claude triage, updates Zammad |
| `GET /dashboard` | IT staff queue — all tickets with AI analysis |
| `GET /dashboard/tickets/[id]` | Ticket detail — draft editor, approve & send |
| `GET /dashboard/analytics` | Category breakdown, deflection rate over time |
| `GET /request` | Public self-service access request form |
| Resend | Sends manager approval emails + requester confirmations |
| PostgreSQL + Prisma | Stores triage results, access requests, KB articles |

---

## Ticket categories

| Category | Auto-action |
|---|---|
| `junk` | Auto-close, no reply |
| `password_reset` | Auto-reply with Microsoft SSPR link, close |
| `external_vendor` | Auto-reply with vendor contact, close |
| `access_request` | Auto-reply directing to `/request` form, close |
| `security_report` | Draft reply, queue for human (also escalates) |
| `hardware` | Draft reply, queue for human |
| `software_howto` | Draft reply, queue for human |
| `billing_netsuite` | Draft reply, queue for human |
| `email_issue` | Draft reply, queue for human |
| `other` | Draft reply, queue for human |

---

## Documentation

| Doc | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | System design, data flow, component diagram |
| [Setup Guide](docs/setup-guide.md) | Prerequisites, environment variables, database, deployment |
| [Zammad Configuration](docs/zammad-configuration.md) | Postmaster filters, webhook trigger, custom fields, email templates |
| [How Triage Works](docs/how-triage-works.md) | Categories, priorities, Claude prompting, auto-actions |
| [Self-Service Form](docs/self-service-form.md) | The `/request` form — sharing it, customizing systems, approval flow |
| [Email Templates](docs/email-templates.md) | Installing the new Zammad notification email designs |

---

## Quick start

```bash
# 1. Clone
git clone git@github.com:ciscosanchez/helpdesk.git
cd helpdesk

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Fill in .env — see docs/setup-guide.md

# 4. Set up database
npx prisma generate
npx prisma db push

# 5. Run
npm run dev
```

See [docs/setup-guide.md](docs/setup-guide.md) for the full setup including Zammad configuration.

---

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **shadcn/ui** component library
- **Prisma** + **PostgreSQL**
- **Anthropic Claude** (`claude-sonnet-4-6`) for ticket triage
- **Resend** for transactional email
- **NextAuth v5** with **Microsoft Entra ID** (SSO)
- **Zammad** REST API + webhooks
