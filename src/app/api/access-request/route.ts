import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import { postArticle } from "@/lib/zammad";
import { z } from "zod";

const resend = new Resend(process.env.RESEND_API_KEY!);

const schema = z.object({
  requesterName: z.string().min(2),
  requesterEmail: z.string().email(),
  systemNeeded: z.string().min(1),
  reason: z.string().min(10),
  managerEmail: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Save to DB
    const accessRequest = await db.accessRequest.create({ data });

    // Create a Zammad ticket via API (structured, tagged — no email noise)
    let zammadTicketId: number | null = null;
    try {
      const ZAMMAD_URL = process.env.ZAMMAD_URL!;
      const ZAMMAD_TOKEN = process.env.ZAMMAD_TOKEN!;

      const res = await fetch(`${ZAMMAD_URL}/api/v1/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Token token=${ZAMMAD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Access Request: ${data.systemNeeded} for ${data.requesterName}`,
          group: "Users",
          customer: data.requesterEmail,
          article: {
            subject: `Access Request: ${data.systemNeeded}`,
            body: `Name: ${data.requesterName}\nEmail: ${data.requesterEmail}\nSystem: ${data.systemNeeded}\nReason: ${data.reason}\nManager: ${data.managerEmail}`,
            type: "note",
            sender: "Customer",
            content_type: "text/plain",
            internal: false,
          },
          ai_category: "access_request",
          tags: "access_request,self-service",
        }),
      });

      if (res.ok) {
        const ticket = await res.json();
        zammadTicketId = ticket.id;
        await db.accessRequest.update({
          where: { id: accessRequest.id },
          data: { zammadTicketId: ticket.id },
        });

        // Add internal note for context
        await postArticle({
          ticketId: ticket.id,
          subject: "Self-Service Access Request",
          body: `Submitted via self-service form.\nManager for approval: ${data.managerEmail}`,
          internal: true,
        });
      }
    } catch (e) {
      console.error("[access-request] Zammad ticket creation failed:", e);
    }

    // Email the manager
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: data.managerEmail,
      subject: `Access Request: ${data.requesterName} needs ${data.systemNeeded}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 18px; margin-bottom: 4px;">Access Request</h2>
          <p style="color: #666; font-size: 14px; margin-top: 0;">Approval needed</p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #666; width: 140px;">Employee</td><td style="padding: 8px 0; font-weight: 500;">${data.requesterName}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${data.requesterEmail}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">System needed</td><td style="padding: 8px 0; font-weight: 500;">${data.systemNeeded}</td></tr>
            <tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Reason</td><td style="padding: 8px 0;">${data.reason}</td></tr>
          </table>
          <p style="font-size: 14px; color: #666;">Please reply to this email to approve or deny, or contact IT at helpdesk@goarmstrong.com.</p>
          ${zammadTicketId ? `<p style="font-size: 12px; color: #999;">Reference: Ticket #${zammadTicketId}</p>` : ""}
        </div>
      `,
    });

    // Confirmation email to requester
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: data.requesterEmail,
      subject: `Your access request for ${data.systemNeeded} has been received`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 18px; margin-bottom: 4px;">Request Received</h2>
          <p style="font-size: 14px; color: #444;">Hi ${data.requesterName},</p>
          <p style="font-size: 14px; color: #444;">We've received your request for access to <strong>${data.systemNeeded}</strong> and have notified your manager (${data.managerEmail}) for approval.</p>
          <p style="font-size: 14px; color: #444;">Once approved, IT will set up your access and follow up with you directly. This typically happens within 1 business day.</p>
          <p style="font-size: 14px; color: #666; margin-top: 24px;">Armstrong IT Helpdesk</p>
          ${zammadTicketId ? `<p style="font-size: 12px; color: #999;">Reference: Ticket #${zammadTicketId}</p>` : ""}
        </div>
      `,
    });

    return NextResponse.json({ ok: true, id: accessRequest.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data", details: err.issues }, { status: 422 });
    }
    console.error("[POST /api/access-request]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
