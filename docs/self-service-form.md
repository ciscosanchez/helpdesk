# Self-Service Access Request Form

## Overview

The self-service form at `/request` lets Armstrong employees request system access without emailing IT. It replaces a large category of tickets — access requests were 27% of the sample tickets analyzed, making it the single biggest category.

The form is **public** — no login required. Anyone with the link can fill it out.

---

## What the form collects

| Field | Purpose |
|---|---|
| Your Name | Identifies the requester |
| Your Armstrong Email | Where the confirmation is sent |
| System / Application Needed | Dropdown of known Armstrong systems |
| Why do you need access? | Context for IT and manager approval |
| Your Manager's Email | Manager receives the approval request |

---

## Systems in the dropdown

The current list covers the systems that appear most frequently in access request tickets:

- ARCC
- Converge Marketplace
- Converge Move
- VersaPay
- Flow WMS
- Bookstack (Internal Wiki)
- Local Dispatch
- NetSuite
- CargoWise
- Microsoft 365 / Email
- OneDrive / SharePoint
- Other

### Adding a new system

Edit `src/app/request/access-request-form.tsx` — find the `SYSTEMS` array at the top:

```typescript
const SYSTEMS = [
  "ARCC",
  "Converge Marketplace",
  // ... add your system here
];
```

---

## What happens after submission

1. **Saved to database** — the request is stored in PostgreSQL with status `pending`
2. **Zammad ticket created** — a properly-tagged ticket is created via Zammad API (not email). It gets the `access_request` tag and `ai_category: access_request` field set automatically. No noise in the email queue.
3. **Manager email sent** — via Resend, the manager receives a clean email showing who is requesting what and why, with instructions to reply to approve or deny
4. **Requester confirmation** — the requester immediately gets a confirmation email saying their request was received and their manager was notified

### The manager email looks like this

```
Subject: Access Request: Jane Smith needs VersaPay

Jane Smith (jane.smith@goarmstrong.com) has requested access to VersaPay.

System:  VersaPay
Reason:  I'm the new controller for U591 and need full processing access
         for billing reconciliation.

Please reply to this email to approve or deny, or contact IT at
helpdesk@goarmstrong.com.

Reference: Ticket #4521
```

---

## Where to share the form link

The form only works if people know it exists. Put the link everywhere:

### IT email signature
Add to every helpdesk team member's email signature:
```
Need system access? Skip the email → https://helpdesk.goarmstrong.com/request
```

### Zammad acknowledgment email
The customer acknowledgment trigger email (`zammad-templates/customer-ack-trigger-email.html`) already includes the link. When anyone emails IT about access, they immediately get a response directing them to the form.

### Armstrong intranet / Bookstack wiki
Create an IT page that links to both the form and common self-service resources.

### Onboarding checklist
Add to new employee onboarding: "If you need access to any system, use [this form] instead of emailing IT."

---

## Tracking access requests

All submitted requests are stored in the `access_requests` table in PostgreSQL. To view them:

```bash
npx prisma studio
```

Or query directly:
```sql
SELECT requester_name, requester_email, system_needed, status, created_at
FROM access_requests
ORDER BY created_at DESC;
```

The dashboard analytics page also shows the access request volume alongside ticket triage data.

---

## Updating request status

Currently the status field (`pending` / `approved` / `denied`) must be updated manually in the database or via Prisma Studio. A future improvement would be to add approve/deny links directly in the manager email — clicking approve automatically updates the status and triggers IT to provision access.

To update status manually:
```bash
npx prisma studio
# Open AccessRequest table, find the record, update status field
```

---

## Customizing the form

### Changing the page copy

Edit `src/app/request/page.tsx` — the heading, description, and footer contact link are all plain text.

### Changing confirmation emails

Edit `src/app/api/access-request/route.ts`:
- Manager email: find the `resend.emails.send` call with the manager's address — edit the HTML body
- Requester confirmation: the second `resend.emails.send` call

### Removing the manager approval step

If you want to skip manager approval and go straight to IT, remove the manager email field from the form and the Resend call in the API route.
