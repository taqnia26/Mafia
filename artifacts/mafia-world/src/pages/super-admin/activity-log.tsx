import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Event {
  id: number; type: string; description: string; createdAt: string; username: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  crime_success: "text-green-400 bg-green-900/20",
  crime_failure: "text-red-400 bg-red-900/20",
  attack_sent: "text-orange-400 bg-orange-900/20",
  attack_won: "text-yellow-400 bg-yellow-900/20",
  attack_lost: "text-slate-400 bg-slate-700/20",
  property_purchased: "text-blue-400 bg-blue-900/20",
  income_collected: "text-emerald-400 bg-emerald-900/20",
  prison_released: "text-purple-400 bg-purple-900/20",
};

export default function SuperAdminActivityLog() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    const r = await fetch(`/api/super-admin/activity-log?${params}`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json() as { events: Event[]; total: number };
      setEvents(d.events);
      setTotal(d.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Activity Log <span className="text-slate-400 text-base font-normal">({total} entries, last 30 days)</span></h1>

        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by username..."
          className="bg-[#1e293b] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#ef4444] w-56"
        />

        {/* Mobile card stack */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="bg-[#1e293b] rounded-xl border border-slate-700 py-8 text-center text-slate-500 text-sm">Loading...</div>
          ) : events.map(e => (
            <div key={e.id} className="bg-[#1e293b] rounded-xl border border-slate-700 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${TYPE_COLORS[e.type] ?? "text-slate-400 bg-slate-700/20"}`}>{e.type}</span>
                <span className="text-xs text-slate-500 text-right shrink-0">{new Date(e.createdAt).toLocaleString("en-US")}</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-300 break-words">{e.description}</div>
              <div className="mt-1 text-xs text-slate-500">{e.username ?? "—"}</div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-right px-4 py-3">Time</th>
                <th className="text-left px-3 py-3">Player</th>
                <th className="text-left px-3 py-3">Type</th>
                <th className="text-left px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : events.map(e => (
                <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-2.5 text-right text-slate-500 text-xs whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-slate-300 text-xs">{e.username ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded ${TYPE_COLORS[e.type] ?? "text-slate-400 bg-slate-700/20"}`}>{e.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">← Prev</button>
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">Next →</button>
        </div>
      </div>
    </AdminLayout>
  );
}
