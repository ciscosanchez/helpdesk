# Architecture

## Overview

The helpdesk app sits between Zammad (your ticket system) and your IT staff. It doesn't replace Zammad — it adds an AI intelligence layer on top of it, so that by the time a ticket reaches your team it already has a category, a priority, and a ready-to-send reply.

```
                        ┌─────────────────────────────────────────┐
  Email arrives         │              ZAMMAD                     │
  from user    ──────►  │  - Receives email                       │
                        │  - Creates ticket (SR#XXXXXXX)          │
                        │  - Fires webhook trigger                │
                        └────────────────┬────────────────────────┘
                                         │  POST /api/webhooks/zammad
                                         │  (ticket + article body)
                                         ▼
                        ┌─────────────────────────────────────────┐
                        │         HELPDESK APP (this)             │
                        │                                         │
                        │  1. Verify HMAC signature               │
                        │  2. Deduplicate (already triaged?)      │
                        │  3. Call Claude triage engine           │
                        │     → category, priority,              │
                        │       confidence, draft reply,          │
                        │       auto_action                       │
                        │  4. Save to PostgreSQL                  │
                        │  5. PATCH Zammad:                       │
                        │     - Set ai_category, ai_priority      │
                        │     - Add internal triage note          │
                        │     - Tag ticket (ai:category)          │
                        │  6. Execute auto-action:                │
                        │     - junk → close ticket               │
                        │     - password_reset → send SSPR link   │
                        │     - external_vendor → send contact    │
                        │     - access_request → send form link   │
                        │     - others → queue for human          │
                        └────────────┬────────────────────────────┘
                                     │
                     ┌───────────────┼───────────────────┐
                     ▼               ▼                   ▼
             Auto-handled       IT Dashboard         Analytics
             (closed in        (queue + draft       (category
              Zammad)           editor + send)       breakdown)
```

---

## Data flow

### New ticket (full flow)

1. User sends email to `helpdesk@goarmstrong.com`
2. Zammad receives it, creates ticket with SR# number
3. Zammad trigger fires `POST /api/webhooks/zammad` with ticket + article payload
4. App verifies the HMAC signature (`X-Hub-Signature` header)
5. App checks PostgreSQL — if already triaged, returns early (idempotent)
6. App calls Claude with the ticket subject, sender, and body
7. Claude returns JSON: `{ category, priority, confidence, summary, draftReply, autoAction }`
8. App saves a `TriagedTicket` row to PostgreSQL
9. App calls Zammad API:
   - `PATCH /api/v1/tickets/{id}` — sets `ai_category`, `ai_priority`, `ai_confidence`
   - `POST /api/v1/ticket_articles` — posts internal note with triage summary
   - `POST /api/v1/tags/add` — tags ticket with `ai:{category}`
10. If `autoAction = auto_closed`: closes ticket in Zammad
11. If `autoAction = auto_replied`: posts public reply to customer + closes ticket
12. If `autoAction = pending_human`: ticket appears in dashboard for IT to review

### IT staff approves a draft

1. IT staff opens `/dashboard` — sees queue sorted by priority
2. Clicks ticket — sees original email + Claude's draft reply
3. Edits draft if needed
4. Clicks "Approve & Send"
5. App calls `POST /api/v1/ticket_articles` in Zammad with the reply (sends email to customer)
6. App marks ticket as reviewed + sent in PostgreSQL
7. Optionally closes the Zammad ticket

### Access request (self-service)

1. User visits `/request` (no login required — public page)
2. Fills form: name, email, system needed, reason, manager email
3. App saves `AccessRequest` to PostgreSQL
4. App creates a Zammad ticket via API (structured, pre-tagged — no email noise)
5. Resend emails the manager: "John needs access to ARCC — please approve"
6. Resend emails the requester: "We got your request, manager has been notified"

---

## Database schema

```
TriagedTicket
├── id (cuid)
├── zammadTicketId (unique int) ← Zammad's ticket ID
├── ticketNumber (string) ← SR#XXXXXXX
├── subject
├── fromEmail / fromName
├── body (full email text)
├── category (see categories doc)
├── priority (1–5)
├── confidence (0–100)
├── draftReply (Claude's suggested reply)
├── autoAction (auto_closed | auto_replied | pending_human)
├── reviewedBy / reviewedAt (who approved the draft)
├── sentAt (when reply was sent)
└── createdAt / updatedAt

AccessRequest
├── id (cuid)
├── requesterName / requesterEmail
├── systemNeeded (dropdown value)
├── reason
├── managerEmail
├── status (pending | approved | denied)
├── zammadTicketId (linked Zammad ticket)
└── createdAt / updatedAt

Setting
├── key (primary key — one of the 6 known setting keys)
├── value (stored in plaintext — DB access is restricted)
├── updatedBy (email of the staff member who last saved it)
└── updatedAt

KbArticle (for future use)
├── id, title, body, category, keywords[], active
└── createdAt / updatedAt
```

---

## Key files

```
src/
├── app/
│   ├── api/
│   │   ├── webhooks/zammad/route.ts    ← Main webhook receiver
│   │   ├── tickets/[id]/route.ts       ← GET single ticket triage data
│   │   ├── tickets/[id]/approve/route.ts ← POST: send approved draft
│   │   ├── tickets/route.ts            ← GET ticket list
│   │   ├── access-request/route.ts     ← POST: self-service form handler
│   │   ├── settings/route.ts           ← GET statuses / POST save credentials
│   │   ├── settings/test/route.ts      ← POST: test Zammad connection
│   │   └── auth/[...nextauth]/route.ts ← NextAuth SSO handler
│   ├── dashboard/
│   │   ├── page.tsx                    ← Ticket queue
│   │   ├── layout.tsx                  ← Nav + auth check
│   │   ├── analytics/page.tsx          ← Analytics
│   │   ├── settings/
│   │   │   ├── page.tsx                ← Settings page (server)
│   │   │   └── settings-form.tsx       ← Credential form (client)
│   │   └── tickets/[id]/
│   │       ├── page.tsx                ← Ticket detail (server)
│   │       └── ticket-actions.tsx      ← Draft editor + approve (client)
│   ├── request/
│   │   ├── page.tsx                    ← Self-service form page
│   │   └── access-request-form.tsx     ← Form component (client)
│   └── login/page.tsx                  ← Microsoft SSO login
├── lib/
│   ├── triage.ts       ← Claude triage engine (core logic)
│   ├── zammad.ts       ← Zammad REST API client
│   ├── auth.ts         ← NextAuth config
│   ├── db.ts           ← Prisma singleton
│   └── types.ts        ← Shared types, category labels/colors
├── components/
│   ├── category-badge.tsx  ← CategoryBadge + PriorityBadge
│   └── ui/                 ← shadcn/ui components
├── proxy.ts            ← Route protection (all except /request + webhooks)
prisma/
├── schema.prisma       ← DB models (no datasource url — see prisma.config.ts)
prisma.config.ts        ← Prisma 7 config — reads DATABASE_URL from .env
zammad-templates/
├── ticket_create-en.html.erb.custom   ← Agent notification: new ticket
├── ticket_update-en.html.erb.custom   ← Agent notification: ticket updated
└── customer-ack-trigger-email.html    ← Customer-facing acknowledgment
```

---

## Authentication

The IT dashboard is protected by Microsoft Entra ID (Azure AD) SSO via NextAuth v5. Staff log in with their Armstrong Microsoft accounts — no separate passwords.

Public routes (no auth required):
- `/request` — self-service access request form
- `/api/webhooks/zammad` — Zammad webhook (protected by HMAC instead)
- `/api/auth/*` — NextAuth endpoints
- `/login` — login page

Everything else requires an authenticated session. Route protection is in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`).

**Dev mode:** When Azure AD env vars are not set, a simple dev login is available on the login page (any email + any password). It activates automatically in `NODE_ENV=development` only. See [authentication.md](authentication.md) for full setup instructions including how to get rid of dev mode.

## Settings screen

Credentials can be entered through the browser at `/dashboard/settings` instead of editing `.env`. Values are stored in the `settings` table in PostgreSQL and take priority over `.env` variables. The settings service (`src/lib/settings.ts`) maintains a 60-second in-process cache to avoid repeated DB reads per request.

Azure AD credentials (`AZURE_AD_*`, `AUTH_SECRET`) are the only ones that cannot be managed through the Settings screen — they are required before you can log in, so they must remain in `.env`.

---

## Database

**Engine:** PostgreSQL 16, running locally on `localhost:5432`
**Database name:** `armstrong_helpdesk`
**ORM:** Prisma 7

Prisma 7 uses a `prisma.config.ts` file at the project root to configure the datasource URL — unlike earlier Prisma versions where the `url` lived inside `schema.prisma`. The schema only declares the provider (`postgresql`); the actual connection string is read from `DATABASE_URL` in `.env` at runtime via `prisma.config.ts`.

```typescript
// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env["DATABASE_URL"] },
});
```

This means **`npx prisma generate` must be run with a valid `.env` present**, otherwise Prisma won't know the database URL.

---

## Security

- **Webhook HMAC**: Every Zammad webhook request is verified with `sha1` HMAC using `ZAMMAD_WEBHOOK_SECRET`. Requests without a valid signature return 401.
- **SSO**: Dashboard requires Microsoft SSO — no passwords stored in this app.
- **Env vars**: All secrets (API keys, DB URL, SSO credentials) are environment variables. `.env` is gitignored.
- **Input validation**: Access request form uses Zod schema validation.
- **No exec/shell**: No user-supplied data is ever passed to shell commands.
