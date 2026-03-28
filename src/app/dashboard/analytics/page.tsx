import { db } from "@/lib/db";
import { CATEGORY_LABELS, type TicketCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [total, categoryCounts, autoActionCounts, priorityCounts] = await Promise.all([
    db.triagedTicket.count(),
    db.triagedTicket.groupBy({ by: ["category"], _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
    db.triagedTicket.groupBy({ by: ["autoAction"], _count: { id: true } }),
    db.triagedTicket.groupBy({ by: ["priority"], _count: { id: true }, orderBy: { priority: "asc" } }),
  ]);

  const pending = autoActionCounts.find((a: { autoAction: string | null; _count: { id: number } }) => a.autoAction === "pending_human")?._count.id ?? 0;
  const autoHandled = total - pending;
  const deflectionRate = total > 0 ? Math.round((autoHandled / total) * 100) : 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">All-time ticket triage breakdown</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Triaged" value={total} />
        <StatCard label="Auto-Handled" value={autoHandled} color="green" />
        <StatCard label="Needed Human" value={pending} color="amber" />
        <StatCard label="Deflection Rate" value={`${deflectionRate}%`} color="blue" />
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">By Category</h2>
        <div className="space-y-3">
          {categoryCounts.map((c: { category: string; _count: { id: number } }) => {
            const pct = total > 0 ? Math.round((c._count.id / total) * 100) : 0;
            const label = CATEGORY_LABELS[c.category as TicketCategory] ?? c.category;
            return (
              <div key={c.category} className="flex items-center gap-3">
                <div className="w-36 text-xs text-gray-600 shrink-0">{label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-500 w-16 text-right">{c._count.id} ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">By Priority</h2>
        <div className="space-y-3">
          {priorityCounts.map((p: { priority: number; _count: { id: number } }) => {
            const pct = total > 0 ? Math.round((p._count.id / total) * 100) : 0;
            const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-gray-300"];
            return (
              <div key={p.priority} className="flex items-center gap-3">
                <div className="w-36 text-xs text-gray-600 shrink-0">P{p.priority} – {["", "Critical", "High", "Normal", "Low", "Noise"][p.priority]}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className={`${colors[p.priority] ?? "bg-gray-400"} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-500 w-16 text-right">{p._count.id} ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-action breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Auto-Action Results</h2>
        <div className="grid grid-cols-3 gap-4">
          {autoActionCounts.map((a: { autoAction: string | null; _count: { id: number } }) => (
            <div key={a.autoAction} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{a._count.id}</div>
              <div className="text-xs text-gray-500 mt-1">{a.autoAction ?? "unknown"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    green: "text-green-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className={`text-2xl font-bold ${color ? colors[color] : "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
