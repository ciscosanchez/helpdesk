# How AI Triage Works

## The 10-second version

When a ticket arrives, Claude reads the email subject, sender, and body. It returns a structured JSON object with a category, priority score, confidence percentage, one-sentence summary, a full draft reply, and a recommended action. The app then acts on that recommendation — closing, replying, or queuing for human review.

---

## What Claude knows about Armstrong

The triage prompt is pre-loaded with Armstrong-specific context:

- **Internal systems:** NetSuite, ARCC, Converge (Unigroup), CargoWise (WiseTech), Flow WMS, VersaPay, Local Dispatch, Bookstack, EndpointCentral, SentinelOne/LMNTRIX
- **External contacts:** Unigroup Helpdesk `(800) 825-9585` handles Converge and Quotes to Go; WiseTech handles CargoWise
- **Microsoft SSPR:** `https://aka.ms/sspr` for self-service password resets
- **Self-service form:** `/request` on this app for access requests
- **Executives:** Tom Pera (President), William Carroll (President Birmingham), Larry Goldman (Enterprise SVP), Adrian Tudose (VP Operations) — any ticket from these individuals is automatically priority 1

---

## Categories

| Category | What it covers | Auto-action |
|---|---|---|
| `access_request` | Give X access to Y system, permissions change, new user setup, remove access | Auto-reply with link to `/request` form, close |
| `password_reset` | Can't log in, needs password reset | Auto-reply with SSPR link (`https://aka.ms/sspr`), close |
| `software_howto` | How do I use X, error message, setup help (NetSuite, CargoWise, etc.) | Draft reply, queue for human |
| `security_report` | Phishing email report, scam text, suspicious activity | Draft acknowledgment, queue for human + escalate |
| `hardware` | Physical device issues — monitors, printers, phones, laptops, connectivity | Draft reply, queue for human |
| `external_vendor` | Issue belongs to Unigroup or WiseTech — Armstrong IT can't fix it | Auto-reply with vendor contact, close |
| `junk` | Automated system notifications — Outlook digests, monitoring alerts, merge notifications | Auto-close, no reply |
| `billing_netsuite` | NetSuite billing, invoices, dunning letters, order number questions | Draft reply, queue for human |
| `email_issue` | Email delivery problems, shared inbox requests, email access | Draft reply, queue for human |
| `other` | Anything that doesn't fit above | Draft reply, queue for human |

---

## Priority scale

| Priority | Meaning | Example |
|---|---|---|
| P1 | Executive/VP sender, or production outage affecting multiple users | Tom Pera reports a text scam; phone system down company-wide |
| P2 | Urgent but not executive; user is completely blocked | Exec VP can't access internet after firmware update |
| P3 | Standard request; user is partially blocked | Password reset; access to VersaPay |
| P4 | Low urgency; general question or minor issue | NetSuite how-to question; monitor occasionally glitches |
| P5 | Automated notification or junk | Outlook reaction digest; Endpoint Central alert |

Priority is determined from two signals:
1. **Sender seniority** — executives and VPs in the known list auto-get P1
2. **Issue impact** — "completely blocked" language, "all users affected", "production down" push priority up

---

## Confidence score

The confidence score (0–100%) reflects how certain Claude is about its classification. A few examples from real Armstrong tickets:

| Ticket | Category | Confidence | Why |
|---|---|---|---|
| "Reaction Daily Digest" automated email | junk | 99% | Unmistakable pattern |
| "Can I get a password reset please?" | password_reset | 99% | Crystal clear |
| "Quotes to Go alerts not receiving" | external_vendor | 95% | Clear signal: Unigroup product |
| "NetSuite pop-up blocking invoice" | billing_netsuite | 90% | NetSuite + billing context |
| "Two things for Jim Fahrney" | access_request | 85% | Explicit access grant request |
| Forwarded suspicious email | security_report | 92% | Phishing report pattern |

Low confidence (below ~70%) can indicate:
- Mixed signals (e.g., email issue that's also an access problem)
- Vague subject line with little body content
- Unusual ticket types not covered by training examples

Low confidence tickets are always queued for human review regardless of category.

---

## Few-shot examples baked in

The triage prompt includes 7 real Armstrong tickets as examples. This anchors Claude to Armstrong's actual ticket patterns rather than generic IT support scenarios. The examples cover:

1. Outlook digest → junk → auto-close
2. Password reset → auto-reply with SSPR link
3. Quotes to Go help → external_vendor → Unigroup contact
4. VersaPay access for two users → access_request → form link
5. Potential phish report → security_report → acknowledgment + human
6. NetSuite pop-up blocking invoice → billing_netsuite → how-to guidance
7. President reporting text scam → security_report P1 → brief acknowledgment

---

## Draft reply guidelines

Claude writes replies with these guardrails:
- **Tone:** Professional and warm — not stiff corporate, not overly casual
- **Greeting:** "Hi [FirstName]" if the name is known, "Hi there" if not — never "Dear"
- **Sign-off:** Always "Armstrong IT Helpdesk"
- **Length:** Concise — direct answer first, then any clarifying steps. No filler.
- **For external vendor tickets:** Always includes the exact phone number or URL (never just "contact the vendor")
- **For security reports:** Immediate acknowledgment + reassurance, no panic, no details

---

## Auto-action logic

```
if category == "junk":
    → close ticket in Zammad immediately
    → no customer reply sent

if category == "password_reset" AND confidence >= ~80:
    → post public reply: "Hi X, reset your password at https://aka.ms/sspr..."
    → close ticket

if category == "external_vendor" AND confidence >= ~80:
    → post public reply: "Hi X, this is handled by [Vendor] at [contact]..."
    → close ticket

if category == "access_request" AND confidence >= ~80:
    → post public reply: "Hi X, please use our self-service form at /request..."
    → close ticket

else (security_report, hardware, software_howto, billing_netsuite, email_issue, other):
    → save draft reply to dashboard
    → add internal triage note to Zammad
    → tag ticket
    → wait for human to review and approve
```

All auto-sent replies are visible in Zammad as normal ticket articles — IT staff can see exactly what was sent.

---

## Adjusting triage behavior

Everything is in `src/lib/triage.ts`. Things you might want to change:

### Add a new system to the Armstrong context
Edit the `SYSTEM_PROMPT` constant — add the system name and who supports it.

### Change a vendor contact
Edit `VENDOR_CONTACTS` at the top of the file.

### Add a new few-shot example
Add to `FEW_SHOT_EXAMPLES`. Format: `From: X | Subject: Y\nBody: Z\n→ {json}`

### Change an auto-action
The auto-action rules are enforced in Claude's system prompt (`Auto-action rules:` section). Edit the prompt to change when auto-actions fire.

### Stop auto-sending for a category
Change the auto-action for that category from `auto_replied` to `pending_human` in the prompt.

### Enable auto-send for all high-confidence tickets
Currently all non-junk tickets require human approval. To enable auto-send for specific categories when confidence ≥ 90%, add logic in `src/app/api/webhooks/zammad/route.ts` after the triage result is received.
