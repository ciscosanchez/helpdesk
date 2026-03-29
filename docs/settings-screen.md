# Settings Screen

## Overview

The Settings screen at `/dashboard/settings` lets you enter API credentials through the browser instead of editing `.env` files. Values are stored in the PostgreSQL database and take priority over `.env` variables.

---

## What can be configured here

| Setting | Description |
|---|---|
| **Zammad URL** | Base URL of your Zammad instance, no trailing slash. Example: `https://helpdesk.goarmstrong.com` |
| **Zammad API Token** | Token from Zammad → Profile → Token Access. Needs `ticket.agent` permission. |
| **Webhook Secret** | HMAC secret — must match exactly what's set in Zammad's webhook config. |
| **Anthropic API Key** | From console.anthropic.com — used for Claude AI triage. |
| **Resend API Key** | From resend.com — used to send manager approval and confirmation emails. |
| **Email From Address** | Sender address for outgoing emails. Must be on your verified Resend domain. Example: `IT Helpdesk <helpdesk@goarmstrong.com>` |

---

## What cannot be configured here

The following must stay in `.env` because they are needed to log in — and you can't reach the Settings screen without being logged in:

| Setting | Why |
|---|---|
| `AUTH_SECRET` | Signs session cookies — required before any page loads |
| `AZURE_AD_CLIENT_ID` | Required for Microsoft SSO |
| `AZURE_AD_CLIENT_SECRET` | Required for Microsoft SSO |
| `AZURE_AD_ISSUER` | Required for Microsoft SSO |
| `DATABASE_URL` | Required to connect to the database where settings are stored |

---

## How settings are resolved

For each credential, the app checks in this order:

1. **Database** — value was saved via the Settings screen
2. **Environment variable** — value in `.env` or hosting platform env
3. **Unset** — not configured anywhere

The source is shown as a badge next to each field:
- Green **"Saved in DB"** — value is in the database (will be used)
- Blue **".env"** — value comes from environment variable
- Red **"Not configured"** — not set anywhere (feature will fail)

---

## Sensitive fields

API tokens and secrets are never sent back to the browser after being saved. The input fields for sensitive values show a placeholder ("Leave blank to keep existing value") when a value is already configured. Use the **Show/Hide** toggle to reveal a value you're actively typing.

After clicking Save, sensitive field values are cleared from the form — they are not stored in browser memory.

---

## Test Connection

The Zammad section has a **Test Connection** button. Clicking it calls `/api/settings/test`, which:

1. Reads the current Zammad URL and Token (from DB or env)
2. Makes a `GET /api/v1/users/me` request to Zammad
3. Shows inline result: "Connected successfully. Logged in as [name]" or an error message

Use this to verify your Zammad credentials immediately after saving.

---

## How values are stored

Settings are stored in the `settings` table in PostgreSQL:

```
key        value              updated_by                    updated_at
---------- ------------------ ----------------------------- --------------------
ZAMMAD_URL https://...        cisco.sanchez@goarmstrong.com 2026-03-28T14:00:00Z
ZAMMAD_TOKEN abc123...        cisco.sanchez@goarmstrong.com 2026-03-28T14:00:00Z
```

The `updated_by` field records the email of the logged-in user who saved the setting, providing an audit trail.

Values are cached in memory for 60 seconds to avoid a database query on every request. Changes take effect within 60 seconds of saving.

---

## Security

- Settings are stored as plaintext in the database — ensure your PostgreSQL instance is not publicly accessible
- Only authenticated IT staff can access the Settings screen (protected by the same SSO as the rest of the dashboard)
- Sensitive values are never included in `GET /api/settings` responses — the API returns source/configured status only, never the raw value
