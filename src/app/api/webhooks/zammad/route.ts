import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { triageTicket } from "@/lib/triage";
import {
  closeTicket,
  postArticle,
  addTag,
  setAiFields,
  type ZammadWebhookPayload,
} from "@/lib/zammad";

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function extractSenderFromArticle(article: ZammadWebhookPayload["articles"][0]) {
  // "From" header is usually "Display Name <email@example.com>"
  const from = article.from ?? "";
  const emailMatch = from.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : from.trim();
  const nameMatch = from.match(/^([^<]+)</);
  const name = nameMatch ? nameMatch[1].trim() : undefined;
  return { email, name };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("x-hub-signature") ?? "";
    const secret = process.env.ZAMMAD_WEBHOOK_SECRET ?? "";

    // Verify HMAC if secret is configured
    if (secret && !verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody.toString()) as ZammadWebhookPayload;
    const ticket = payload.ticket;
    const articles = payload.articles ?? [];

    if (!ticket?.id) {
      return NextResponse.json({ error: "No ticket in payload" }, { status: 400 });
    }

    // Deduplicate — don't re-triage tickets we've already processed
    const existing = await db.triagedTicket.findUnique({
      where: { zammadTicketId: ticket.id },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Use the first customer-sent article as the body
    const customerArticle = articles.find((a) => a.sender === "Customer" && !a.internal) ?? articles[0];
    const body = customerArticle?.body ?? ticket.title ?? "";
    const { email: fromEmail, name: fromName } = customerArticle
      ? extractSenderFromArticle(customerArticle)
      : { email: "unknown@goarmstrong.com", name: undefined };

    // Run Claude triage
    const triage = await triageTicket({
      subject: ticket.title,
      fromEmail,
      fromName,
      body,
    });

    // Save to DB
    await db.triagedTicket.create({
      data: {
        zammadTicketId: ticket.id,
        ticketNumber: ticket.number,
        subject: ticket.title,
        fromEmail,
        fromName,
        body: body.slice(0, 10000),
        category: triage.category,
        priority: triage.priority,
        confidence: triage.confidence,
        draftReply: triage.draftReply || null,
        autoAction: triage.autoAction,
      },
    });

    // Push AI fields back to Zammad
    await setAiFields(ticket.id, {
      ai_category: triage.category,
      ai_priority: triage.priority,
      ai_confidence: triage.confidence,
      ai_draft: triage.draftReply?.slice(0, 2000),
    });

    // Add category tag
    await addTag(ticket.id, `ai:${triage.category}`).catch(() => null);

    // Post internal note with triage summary
    await postArticle({
      ticketId: ticket.id,
      subject: "AI Triage",
      body: `🤖 AI Triage Result\n\nCategory: ${triage.category}\nPriority: ${triage.priority}/5\nConfidence: ${triage.confidence}%\n\n${triage.summary}\n\nAction: ${triage.autoAction}`,
      internal: true,
    }).catch(() => null);

    // Execute auto-actions
    if (triage.autoAction === "auto_closed") {
      await closeTicket(ticket.id);
    } else if (triage.autoAction === "auto_replied" && triage.draftReply) {
      // Post public reply to customer
      await postArticle({
        ticketId: ticket.id,
        subject: `Re: ${ticket.title}`,
        body: triage.draftReply,
        internal: false,
        to: fromEmail,
      });
      // Close auto-handled tickets
      await closeTicket(ticket.id);
    }

    // Update DB with sent time if auto-replied
    if (triage.autoAction !== "pending_human") {
      await db.triagedTicket.update({
        where: { zammadTicketId: ticket.id },
        data: { sentAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, category: triage.category, action: triage.autoAction });
  } catch (err) {
    console.error("[webhook/zammad]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
