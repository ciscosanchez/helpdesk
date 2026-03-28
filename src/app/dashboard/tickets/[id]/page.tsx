import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { CategoryBadge, PriorityBadge } from "@/components/category-badge";
import { TicketActions } from "./ticket-actions";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await db.triagedTicket.findUnique({ where: { id } });
  if (!ticket) notFound();

  const isSent = !!ticket.sentAt;
  const isAutoHandled = ticket.autoAction !== "pending_human";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to queue
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{ticket.subject}</h1>
            <p className="text-sm text-gray-500 mt-1">Ticket #{ticket.ticketNumber}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CategoryBadge category={ticket.category} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          <InfoItem label="From" value={ticket.fromName || ticket.fromEmail} sub={ticket.fromName ? ticket.fromEmail : undefined} />
          <InfoItem label="AI Confidence" value={`${ticket.confidence}%`} />
          <InfoItem label="Received" value={formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })} sub={format(new Date(ticket.createdAt), "MMM d, h:mm a")} />
          <InfoItem
            label="Status"
            value={isSent ? "Sent" : isAutoHandled ? "Auto-handled" : "Needs Review"}
            highlight={!isSent && !isAutoHandled}
          />
        </div>

        {ticket.reviewedBy && (
          <p className="text-xs text-gray-400">
            Handled by {ticket.reviewedBy}{ticket.reviewedAt ? ` · ${format(new Date(ticket.reviewedAt), "MMM d, h:mm a")}` : ""}
          </p>
        )}
      </div>

      {/* Original message */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Original Message</h2>
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
          {ticket.body}
        </div>
      </div>

      {/* Draft reply + actions */}
      <TicketActions ticket={{
        id: ticket.id,
        subject: ticket.subject,
        fromEmail: ticket.fromEmail,
        fromName: ticket.fromName,
        draftReply: ticket.draftReply,
        autoAction: ticket.autoAction,
        sentAt: ticket.sentAt?.toISOString() ?? null,
        zammadTicketId: ticket.zammadTicketId,
      }} />
    </div>
  );
}

function InfoItem({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
