import { getSetting } from "./settings";

async function getCredentials() {
  const [url, token] = await Promise.all([
    getSetting("ZAMMAD_URL"),
    getSetting("ZAMMAD_TOKEN"),
  ]);
  if (!url) throw new Error("ZAMMAD_URL is not configured. Set it in Settings or .env");
  if (!token) throw new Error("ZAMMAD_TOKEN is not configured. Set it in Settings or .env");
  return { url, token };
}

export interface ZammadTicket {
  id: number;
  number: string;
  title: string;
  state: string;
  state_id: number;
  priority: string;
  group: string;
  owner: string;
  customer_id: number;
  article_count: number;
  article_ids: number[];
  created_at: string;
  updated_at: string;
  // custom AI fields (set after triage)
  ai_category?: string;
  ai_priority?: number;
  ai_confidence?: number;
  ai_draft?: string;
  ai_reviewed?: boolean;
}

export interface ZammadArticle {
  id: number;
  ticket_id: number;
  type: string;
  sender: string;
  from: string;
  subject: string;
  body: string;
  content_type: string;
  internal: boolean;
  created_at: string;
}

export interface ZammadWebhookPayload {
  ticket: ZammadTicket;
  articles: ZammadArticle[];
  users?: Record<string, { id: number; email: string; firstname: string; lastname: string }>;
}

async function zammadFetch(path: string, init?: RequestInit) {
  const { url: baseUrl, token } = await getCredentials();
  const url = `${baseUrl}/api/v1${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Token token=${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zammad API error ${res.status} on ${path}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export async function getTicket(id: number): Promise<ZammadTicket> {
  return zammadFetch(`/tickets/${id}?expand=true`);
}

export async function getTicketArticles(ticketId: number): Promise<ZammadArticle[]> {
  return zammadFetch(`/ticket_articles/by_ticket/${ticketId}`);
}

export async function updateTicket(
  id: number,
  fields: Partial<ZammadTicket> & { article?: Partial<ZammadArticle> & { type?: string; sender?: string; content_type?: string } }
) {
  return zammadFetch(`/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function closeTicket(id: number) {
  return updateTicket(id, { state: "closed" });
}

export async function postArticle(opts: {
  ticketId: number;
  subject: string;
  body: string;
  internal: boolean;
  to?: string;
}) {
  return zammadFetch(`/ticket_articles`, {
    method: "POST",
    body: JSON.stringify({
      ticket_id: opts.ticketId,
      subject: opts.subject,
      body: opts.body,
      content_type: "text/plain",
      type: opts.internal ? "note" : "email",
      internal: opts.internal,
      sender: "Agent",
      ...(opts.to ? { to: opts.to } : {}),
    }),
  });
}

export async function addTag(ticketId: number, tag: string) {
  return zammadFetch(`/tags/add`, {
    method: "POST",
    body: JSON.stringify({ item: tag, object: "Ticket", o_id: ticketId }),
  });
}

export async function setAiFields(
  ticketId: number,
  fields: {
    ai_category: string;
    ai_priority: number;
    ai_confidence: number;
    ai_draft?: string;
  }
) {
  return updateTicket(ticketId, fields as unknown as Partial<ZammadTicket>);
}
