# Email Templates

Three redesigned email templates replace Zammad's default notifications. The defaults show walls of auto-generated text with inconsistent formatting. The new templates are clean, minimal, and include only what the reader needs.

---

## Template overview

| File | What it replaces | Audience |
|---|---|---|
| `zammad-templates/ticket_create-en.html.erb.custom` | "New ticket" agent notification | IT staff |
| `zammad-templates/ticket_update-en.html.erb.custom` | "Ticket updated" agent notification | IT staff |
| `zammad-templates/customer-ack-trigger-email.html` | "We received your ticket" customer email | Customers/employees |

---

## Installing the agent notification templates

These templates live on the Zammad server filesystem. You need SSH access to the Zammad server.

**Default template location:**
```
/opt/zammad/app/views/mailer/
```

**Step 1 — Copy files to the Zammad server**

```bash
# From your local machine
scp zammad-templates/ticket_create-en.html.erb.custom \
    user@your-zammad-server:/opt/zammad/app/views/mailer/ticket_create/en.html.erb.custom

scp zammad-templates/ticket_update-en.html.erb.custom \
    user@your-zammad-server:/opt/zammad/app/views/mailer/ticket_update/en.html.erb.custom
```

**Step 2 — Restart Zammad**

```bash
ssh user@your-zammad-server
sudo systemctl restart zammad
```

Or if running with Docker:
```bash
docker-compose restart zammad
```

**Step 3 — Test**

Send a test email to your Zammad inbox. The agent notification you receive should use the new design — dark header, clean info grid, single "Open Ticket →" button.

### Why `.custom` files?

Zammad looks for `.custom` override files before falling back to the original templates. Using `.custom` files means your changes survive Zammad upgrades. Never edit the original `.erb` files directly.

### What the templates use (ERB variables)

```erb
<%= @ticket.title %>           # Ticket subject
<%= @ticket.number %>          # SR#XXXXXXX
<%= @ticket.state.name %>      # new, open, closed, etc.
<%= @ticket.priority.name %>   # 1 normal, 2 high, etc.
<%= @ticket.group.name %>      # Assigned group
<%= @ticket.owner.fullname %>  # Assigned agent
<%= @ticket.customer.fullname %> # Who opened the ticket
<%= @ticket.customer.email %>
<%= @article.body %>           # Email body text
<%= @base_url %>               # Your Zammad instance URL
<%= @ticket.id %>              # Ticket ID (used in deep link)
```

---

## Installing the customer acknowledgment email

This template is installed via Zammad's UI — no server access needed.

**Step 1 — Create a new Trigger**

Zammad Admin → Manage → Triggers → New Trigger

| Field | Value |
|---|---|
| Name | Customer Acknowledgment |
| Activator | Action |
| Condition: Ticket | Action → is → Created |
| Condition: Article | Sender → is → Customer |
| Action | Send Email → To: Customer |

**Step 2 — Set the email subject**

```
We received your request [Ticket ###{ticket.number}]
```

The `##` before `#{ticket.number}` is intentional — it produces the literal `#` character followed by the ticket number in the output.

**Step 3 — Paste the HTML body**

1. In the email body field, find the `<>` icon (Source/HTML mode) and click it
2. Delete any existing content
3. Open `zammad-templates/customer-ack-trigger-email.html` from this repo
4. Copy the entire file contents
5. Paste into the HTML source field
6. Click `<>` again to switch back to visual mode — preview should show the clean design
7. Save the trigger

**Step 4 — Update the links in the template**

The template contains two hardcoded links:
- `https://aka.ms/sspr` — Microsoft self-service password reset (leave as-is)
- `https://helpdesk.goarmstrong.com/request` — your self-service form URL

If your app is deployed at a different URL, update the `/request` link in the template before pasting.

---

## What the new templates look like

### Agent notification (new ticket)

```
┌──────────────────────────────────────┐
│ Armstrong IT Helpdesk        New     │  ← Dark header
├──────────────────────────────────────┤
│ NEW                                  │
│                                      │
│ Cannot access intra armstrong site   │
│ Ticket #1967167                      │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ From     Jim Heffernan <...>   │   │
│ │ Group    Support               │   │
│ │ Priority 2 high                │   │
│ │ State    new                   │   │
│ └────────────────────────────────┘   │
│                                      │
│ MESSAGE                              │
│ | Laptop firmware was updated...     │  ← body with border
│                                      │
│ [Open Ticket →]                      │
│                                      │
│ Armstrong Relocation & Companies...  │  ← Footer
└──────────────────────────────────────┘
```

### Customer acknowledgment

```
┌──────────────────────────────────────┐
│ ARMSTRONG IT HELPDESK                │
│                                      │
│ We got your request.                 │
│                                      │
│ Hi Jim,                              │
│ Your ticket has been received and    │
│ our team will be in touch shortly.   │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ Ticket number   #1967167       │   │
│ │ Subject         Cannot access  │   │
│ └────────────────────────────────┘   │
│                                      │
│ Need something faster?               │
│ Password reset → aka.ms/sspr         │
│ Access request → /request            │
│                                      │
│ Armstrong Relocation & Companies     │
└──────────────────────────────────────┘
```

---

## Troubleshooting

**The old template is still showing after restart**
- Confirm the file is named exactly `en.html.erb.custom` (not `.html.erb` or `.custom.html.erb`)
- Confirm it's in the right subdirectory (`ticket_create/` not `mailer/`)
- Try a full Zammad restart: `sudo zammad stop && sudo zammad start`

**The customer acknowledgment trigger is firing twice**
- Check if there are other triggers also sending emails on ticket creation
- The condition "Article Sender is Customer" prevents it from firing on agent-created tickets

**Zammad variable not rendering (showing as `#{ticket.number}` literally)**
- This happens in Trigger email bodies if the variable syntax is wrong
- Make sure you're using `#{variable}` format (not `<%= @ticket.number %>` — that's only for ERB server templates)
- In trigger emails, the syntax is `#{ticket.number}`, `#{ticket.customer.firstname}`, etc.
