# Zammad Configuration

Everything you need to configure in Zammad to connect it to the helpdesk app.

---

## 1. Postmaster Filters (stop junk from becoming tickets)

These run before a ticket is created. Any email matching these rules is silently discarded — no ticket, no noise.

**Location:** Zammad Admin → Channels → Email → Filters → New Filter

### Filter 1: Outlook Reaction Digests

These are Microsoft's automated "someone reacted to your email" notifications. They flood your queue.

| Field | Value |
|---|---|
| Name | Block Outlook Reaction Digests |
| Match: Subject | contains → `Reaction Daily Digest` |
| Action | Ignore message → YES |

### Filter 2: Bookstack User Registration Webhooks

Bookstack fires a webhook every time someone registers. These shouldn't be tickets.

| Field | Value |
|---|---|
| Name | Block Bookstack Webhooks |
| Match: From | contains → `wiki.goarmstrong.com` |
| Action | Ignore message → YES |

Alternatively, route Bookstack webhooks to a dedicated IT admin group and auto-handle from there.

### Filter 3: Endpoint Central Monitoring Alerts

Automated device management alerts. Not support requests.

| Field | Value |
|---|---|
| Name | Block Endpoint Central Alerts |
| Match: Subject | contains → `Reactivated Computer` |
| Action | Ignore message → YES |

Add additional filters for other Endpoint Central alert subjects as you discover them.

### Filter 4: Auto-Reply / Out of Office Emails

| Field | Value |
|---|---|
| Name | Block Auto-Replies |
| Match: Subject | regex → `^(Auto-Reply\|Out of Office\|Automatic Reply\|Undeliverable\|Delivery Status Notification)` |
| Action | Ignore message → YES |

### Filter 5: Generic No-Reply Senders (monitoring systems)

| Field | Value |
|---|---|
| Name | Block Generic No-Reply Monitoring |
| Match: From | regex → `no-reply@(monitoring\|alerts\|noreply)` |
| Action | Ignore message → YES |

> **Tip:** Check your ticket queue for other recurring junk patterns each week for the first month. Add a filter for each one. After 4–6 weeks you'll have blocked most of the noise permanently.

---

## 2. Custom Ticket Fields (object attributes)

The app writes AI analysis back to Zammad as custom fields on each ticket. Create these before setting up the webhook.

**Location:** Zammad Admin → System → Objects → Ticket → Add Attribute

| Internal Name | Display Name | Type | Notes |
|---|---|---|---|
| `ai_category` | AI Category | Text (readonly) | e.g. `access_request`, `hardware` |
| `ai_priority` | AI Priority | Integer (readonly) | 1–5 scale |
| `ai_confidence` | AI Confidence (%) | Integer (readonly) | 0–100 |
| `ai_draft` | AI Draft Reply | Text area | Claude's suggested reply |
| `ai_reviewed` | AI Reviewed | Boolean | Set to true when a human approves |

After adding each attribute:
- Set "Shown" to Yes (so it appears on the ticket form)
- Set "Editable" to No for `ai_category`, `ai_priority`, `ai_confidence` (AI sets these, not humans)
- Click "Submit" then "Update Database"

---

## 3. Webhook

**Location:** Zammad Admin → Manage → Webhooks → New Webhook

| Field | Value |
|---|---|
| Name | Helpdesk AI Triage |
| Endpoint | `https://helpdesk.goarmstrong.com/api/webhooks/zammad` |
| HTTP Method | POST |
| HTTP Authentication | None (we use HMAC instead) |
| HMAC Token | (same value as `ZAMMAD_WEBHOOK_SECRET` in your `.env`) |
| SSL Verify | Yes (No only for local dev with self-signed cert) |
| Active | Yes |

Leave "Custom Payload" OFF — the default payload includes the full ticket + articles, which is what the app needs.

> **Security note:** The HMAC Token field in Zammad corresponds to `ZAMMAD_WEBHOOK_SECRET` in your app's `.env`. The app verifies every incoming webhook request with this secret. If they don't match, the request is rejected with 401. Use the same value in both places.

---

## 4. Webhook Trigger

The webhook alone doesn't fire automatically — you need a trigger to call it.

**Location:** Zammad Admin → Manage → Triggers → New Trigger

| Field | Value |
|---|---|
| Name | AI Triage — New Ticket |
| Activator | Action |
| Condition: Ticket | Action → is → Created |
| Action | Webhook → select "Helpdesk AI Triage" |
| Active | Yes |

This fires the webhook every time a new ticket is created. That's it.

> **Do not** add conditions like "state is new" or filter by group — you want every new ticket to go through triage.

---

## 5. Customer Acknowledgment Trigger (recommended)

Send customers a clean acknowledgment email immediately when they open a ticket. This replaces Zammad's default ugly notification.

**Location:** Zammad Admin → Manage → Triggers → New Trigger

| Field | Value |
|---|---|
| Name | Customer Acknowledgment |
| Activator | Action |
| Condition: Ticket | Action → is → Created |
| Condition: Article | Sender → is → Customer |
| Action | Send Email → To: Customer |
| Subject | `We received your request [Ticket ###{ticket.number}]` |
| Body | (paste HTML from `zammad-templates/customer-ack-trigger-email.html`) |

To paste the HTML body:
1. In the email body field, click the `<>` (source) button to switch to HTML mode
2. Paste the full contents of `zammad-templates/customer-ack-trigger-email.html`
3. Switch back to visual mode to preview

The template includes links to the SSPR page and the self-service form, so customers who can self-serve will often resolve their own issue before IT even sees the ticket.

---

## 6. Auto-Close for Merged/Admin Notification Emails

Some Zammad admin notifications (ticket merged, owner changed) can accidentally create new tickets if they're cc'd to the helpdesk inbox. Add this trigger:

**Location:** Zammad Admin → Manage → Triggers → New Trigger

| Field | Value |
|---|---|
| Name | Auto-close Admin Notifications |
| Activator | Action |
| Condition: Article | Subject → contains → `MERGED TICKET` |
| Action | Ticket → State → Closed |
| Active | Yes |

---

## 7. Verify the setup

Once everything is configured:

1. Send a test email to your Zammad inbox
2. Wait ~10 seconds
3. Open the ticket in Zammad — you should see:
   - An internal note starting with "🤖 AI Triage Result"
   - The `ai_category` field populated
   - A tag like `ai:hardware` or `ai:access_request`
4. Open your helpdesk dashboard — the ticket should appear there with the AI analysis

If the internal note doesn't appear, check:
- Is the trigger active and pointing to the right webhook?
- Is the webhook URL correct and reachable?
- Is `ZAMMAD_WEBHOOK_SECRET` the same in both Zammad and `.env`?
- Check your app server logs for errors
