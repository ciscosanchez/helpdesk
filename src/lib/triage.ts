import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type TicketCategory =
  | "access_request"
  | "password_reset"
  | "software_howto"
  | "security_report"
  | "hardware"
  | "external_vendor"
  | "junk"
  | "billing_netsuite"
  | "email_issue"
  | "other";

export type AutoAction = "auto_closed" | "auto_replied" | "pending_human";

export interface TriageResult {
  category: TicketCategory;
  priority: number; // 1–5 (1 = most urgent)
  confidence: number; // 0–100
  summary: string; // one sentence for the internal note
  draftReply: string; // customer-facing reply
  autoAction: AutoAction;
}

// Vendor contact info used in draft replies
const VENDOR_CONTACTS: Record<string, string> = {
  converge: "Unigroup Helpdesk at (800) 825-9585",
  cargowise: "WiseTech Global support at support.wiseglobal.com",
  "quotes to go": "Unigroup Helpdesk at (800) 825-9585",
  unigroup: "Unigroup Helpdesk at (800) 825-9585",
};

const SYSTEM_PROMPT = `You are an IT helpdesk triage assistant for Armstrong Relocation & Companies, a moving and logistics company.
Your job is to read an incoming support ticket and return a structured JSON triage result.

Armstrong systems and context:
- Internal systems: NetSuite (ERP/billing), ARCC (order numbers), Converge (sales platform - owned by Unigroup), CargoWise (logistics - owned by WiseTech), Flow WMS, VersaPay, Local Dispatch, Bookstack (internal wiki), EndpointCentral (device management), SentinelOne/LMNTRIX (endpoint security)
- Unigroup Helpdesk: (800) 825-9585 — handles Converge, Quotes to Go, and other Unigroup products
- Microsoft self-service password reset: https://aka.ms/sspr
- Self-service access request form: /request (on this helpdesk site)
- Senior leadership includes Tom Pera (President), William Carroll (President Birmingham), Larry Goldman (Enterprise SVP), Adrian Tudose (VP Operations) — treat their tickets as priority 1

Categories:
- access_request: Someone needs access to a system, permissions change, new user setup, remove access
- password_reset: User cannot log in and needs a password reset
- software_howto: Question about how to use software (NetSuite, CargoWise, etc.), error message, setup help
- security_report: Phishing email report, scam text, suspicious activity
- hardware: Physical device issues — monitors, printers, phones, laptops, connectivity
- external_vendor: Issue belongs to an external vendor (Unigroup/Converge, WiseTech/CargoWise) — Armstrong IT cannot fix it
- junk: Automated system notifications that should not be tickets (Outlook reaction digests, monitoring alerts, merge notifications, auto-replies)
- billing_netsuite: NetSuite billing, invoices, dunning letters, order number questions
- email_issue: Email delivery, shared inbox, email access problems
- other: Anything that doesn't fit above

Priority scale:
1 = Executive/VP sender OR production outage affecting multiple users
2 = Urgent but not executive; single user completely blocked
3 = Standard request; user is partially blocked
4 = Low urgency; general question or minor issue
5 = Automated notification or no action needed

Auto-action rules:
- junk → auto_closed (close with no reply)
- password_reset → auto_replied (reply with SSPR link)
- external_vendor → auto_replied (reply with vendor contact info)
- access_request → auto_replied (reply directing to self-service form)
- all others → pending_human

Draft reply tone: professional, warm, concise. Sign off as "Armstrong IT Helpdesk". Do NOT use "Dear" — use "Hi [FirstName]" if name is known, otherwise "Hi there".

Return ONLY valid JSON matching this exact shape:
{
  "category": "<category>",
  "priority": <1-5>,
  "confidence": <0-100>,
  "summary": "<one sentence describing the issue>",
  "draftReply": "<full reply text to send to the customer>",
  "autoAction": "<auto_closed|auto_replied|pending_human>"
}`;

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1
From: Erik Frescas | Subject: Reaction Daily Digest - Saturday, March 28, 2026
Body: Microsoft Outlook: Guadalupe Ureste reacted to your message...
→ {"category":"junk","priority":5,"confidence":99,"summary":"Automated Microsoft Outlook reaction digest email, not a real ticket.","draftReply":"","autoAction":"auto_closed"}

EXAMPLE 2
From: Brandon King | Subject: Password reset
Body: Can I get a password reset please?
→ {"category":"password_reset","priority":3,"confidence":99,"summary":"User requesting a password reset.","draftReply":"Hi Brandon,\\n\\nYou can reset your own password instantly using Microsoft's self-service portal:\\nhttps://aka.ms/sspr\\n\\nJust enter your Armstrong email address and follow the prompts. It only takes a minute.\\n\\nIf you run into any trouble with the self-service reset, reply here and we'll assist you directly.\\n\\nArmstrong IT Helpdesk","autoAction":"auto_replied"}

EXAMPLE 3
From: Savanna Izquierdo | Subject: Quotes to go Help
Body: If I'm not receiving a specific alert from quotes, do you know who I would contact for that?
→ {"category":"external_vendor","priority":4,"confidence":95,"summary":"Question about Quotes to Go alert configuration — Unigroup product, not Armstrong IT.","draftReply":"Hi Savanna,\\n\\nQuotes to Go is managed by Unigroup, so for alert configuration you'll want to reach out directly to their helpdesk:\\n\\nUnigroup Helpdesk: (800) 825-9585\\n\\nThey'll be able to update your alert settings right away.\\n\\nArmstrong IT Helpdesk","autoAction":"auto_replied"}

EXAMPLE 4
From: Jesi York | Subject: VersaPay Access - U591
Body: Megan Rodelander and Trina Kunkler need full processing access to VersaPay
→ {"category":"access_request","priority":3,"confidence":97,"summary":"Two users need full processing access granted in VersaPay.","draftReply":"Hi Jesi,\\n\\nThanks for reaching out! To keep access requests organized and ensure the right approvals are in place, please submit this through our self-service form:\\n\\nhttps://helpdesk.goarmstrong.com/request\\n\\nIt only takes a couple of minutes and will notify the right people automatically.\\n\\nArmstrong IT Helpdesk","autoAction":"auto_replied"}

EXAMPLE 5
From: Debbie Green | Subject: Potential Phish: Armstrong NetSuite News
Body: [forwarded suspicious email]
→ {"category":"security_report","priority":2,"confidence":92,"summary":"User reporting a potential phishing email impersonating an Armstrong NetSuite communication.","draftReply":"Hi Debbie,\\n\\nThank you for flagging this — we really appreciate the vigilance. We've received your report and our team is reviewing the email right away.\\n\\nIn the meantime, please do not click any links or download any attachments from that email. If others on your team received it, encourage them to report it as well.\\n\\nWe'll update you once we've completed our review.\\n\\nArmstrong IT Helpdesk","autoAction":"pending_human"}

EXAMPLE 6
From: Ashlee Oman | Subject: NetSuite: 6531777
Body: I've come across a NetSuite pop-up that I have not encountered. How do I change this Sales Order so that an invoice can be generated? The Sales Order is OKL-9806-6.
→ {"category":"billing_netsuite","priority":3,"confidence":90,"summary":"User encountering an unfamiliar NetSuite pop-up blocking invoice generation on Sales Order OKL-9806-6.","draftReply":"Hi Ashlee,\\n\\nThanks for reaching out. The pop-up you're seeing on Sales Order OKL-9806-6 typically appears when the order has a billing hold or a required field hasn't been completed.\\n\\nA few things to try:\\n1. Check if the Sales Order status is set to 'Pending Billing' — it needs to be in that status for an invoice to generate.\\n2. Look for any orange warning icons on the form — these usually point to the blocking field.\\n3. If you see a message about a shipping address or item not fulfilled, the order may need to be fulfilled first.\\n\\nIf you can share a screenshot of the pop-up, we can give you a more specific answer.\\n\\nArmstrong IT Helpdesk","autoAction":"pending_human"}

EXAMPLE 7
From: Tom Pera (President) | Subject: New Text Scam
Body: I guess they're gonna try this with Will's name now. [screenshot attached]
→ {"category":"security_report","priority":1,"confidence":95,"summary":"President reporting a text message scam impersonating an Armstrong employee named Will.","draftReply":"Hi Tom,\\n\\nThank you for the heads-up — we're on it. We'll review the screenshot and send a company-wide alert to make sure no one falls for this.\\n\\nArmstrong IT Helpdesk","autoAction":"pending_human"}
`;

export async function triageTicket(opts: {
  subject: string;
  fromEmail: string;
  fromName?: string;
  body: string;
}): Promise<TriageResult> {
  const userMessage = `From: ${opts.fromName || opts.fromEmail} <${opts.fromEmail}>
Subject: ${opts.subject}
Body:
${opts.body.slice(0, 4000)}`; // cap to avoid token bloat

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here are some examples of correct triage decisions:\n${FEW_SHOT_EXAMPLES}\n\nNow triage this ticket:\n\n${userMessage}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Strip any markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  const result = JSON.parse(json) as TriageResult;

  // Enrich external_vendor draft with vendor contact if generic
  if (result.category === "external_vendor" && result.draftReply) {
    const lower = (opts.subject + " " + opts.body).toLowerCase();
    for (const [keyword, contact] of Object.entries(VENDOR_CONTACTS)) {
      if (lower.includes(keyword) && !result.draftReply.includes(contact)) {
        result.draftReply = result.draftReply.replace(
          /Unigroup Helpdesk[^\n]*/,
          contact
        );
        break;
      }
    }
  }

  return result;
}
