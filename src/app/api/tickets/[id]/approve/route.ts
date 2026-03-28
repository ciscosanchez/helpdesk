import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postArticle, closeTicket } from "@/lib/zammad";
import { auth } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { reply, closeAfter = true } = await request.json() as { reply: string; closeAfter?: boolean };

    if (!reply?.trim()) {
      return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
    }

    const ticket = await db.triagedTicket.findUnique({ where: { id } });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (ticket.sentAt) return NextResponse.json({ error: "Already sent" }, { status: 409 });

    // Post public reply to customer in Zammad
    await postArticle({
      ticketId: ticket.zammadTicketId,
      subject: `Re: ${ticket.subject}`,
      body: reply,
      internal: false,
      to: ticket.fromEmail,
    });

    if (closeAfter) {
      await closeTicket(ticket.zammadTicketId);
    }

    // Mark as reviewed + sent
    await db.triagedTicket.update({
      where: { id },
      data: {
        reviewedBy: session.user.email ?? session.user.name ?? "agent",
        reviewedAt: new Date(),
        sentAt: new Date(),
        draftReply: reply, // save final version
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/tickets/:id/approve]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
