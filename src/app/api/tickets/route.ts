import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const pending = searchParams.get("pending") === "true";

    const tickets = await db.triagedTicket.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(pending ? { sentAt: null, autoAction: "pending_human" } : {}),
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json(tickets);
  } catch (err) {
    console.error("[GET /api/tickets]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
