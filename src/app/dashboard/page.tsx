import { db } from "@/lib/db";
import Link from "next/link";
import { CategoryBadge, PriorityBadge } from "@/components/category-badge";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const { category, status } = await searchParams;

  const tickets = await db.triagedTicket.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(status === "pending" ? { sentAt: null, autoAction: "pending_human" } : {}),
      ...(status === "sent" ? { sentAt: { not: null } } : {}),
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const pendingCount = await db.triagedTicket.count({
    where: { sentAt: null, autoAction: "pending_human" },
  });

  const autoHandledCount = await db.triagedTicket.count({
    where: { autoAction: { not: "pending_human" } },
  });

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Needs Review" value={pendingCount} highlight />
        <StatCard label="Auto-Handled" value={autoHandledCount} />
        <StatCard label="Total Triaged" value={tickets.length} />
        <StatCard
          label="Deflection Rate"
          value={
            tickets.length > 0
              ? `${Math.round((autoHandledCount / tickets.length) * 100)}%`
              : "—"
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink href="/dashboard" active={!status && !category}>All</FilterLink>
        <FilterLink href="/dashboard?status=pending" active={status === "pending"}>Needs Review</FilterLink>
        <FilterLink href="/dashboard?status=sent" active={status === "sent"}>Sent / Closed</FilterLink>
        {["access_request", "security_report", "hardware", "billing_netsuite", "external_vendor", "junk"].map((c) => (
          <FilterLink key={c} href={`/dashboard?category=${c}`} active={category === c}>
            <CategoryBadge category={c} />
          </FilterLink>
        ))}
      </div>

      {/* Ticket table */}
      {tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No tickets match this filter.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ticket</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">From</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Confidence</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((t: { id: string; ticketNumber: string; subject: string; fromName: string | null; fromEmail: string; category: string; priority: number; confidence: number; autoAction: string | null; sentAt: Date | null; createdAt: Date }) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tickets/${t.id}`} className="hover:underline">
                      <div className="font-medium text-gray-900 max-w-xs truncate">{t.subject}</div>
                      <div className="text-xs text-gray-400">#{t.ticketNumber}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="max-w-[160px] truncate">{t.fromName || t.fromEmail}</div>
                    <div className="text-xs text-gray-400 truncate">{t.fromName ? t.fromEmail : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={t.category} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${t.confidence}%` }}
                        />
                      </div>
                      <span className="text-xs">{t.confidence}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.sentAt ? (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-md">Sent</span>
                    ) : t.autoAction === "auto_closed" ? (
                      <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">Auto-closed</span>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium">Needs Review</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? "border-amber-200 bg-amber-50" : "border-gray-200"}`}>
      <div className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
      }`}
    >
      {children}
    </Link>
  );
}
