import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Attack {
  id: number; status: string;
  attacker_name: string; target_name: string;
  created_at: string; travel_arrival_at: string | null;
  damage_dealt: number | null; target_survived: boolean | null;
}

const STATUS_FILTERS = ["", "traveling", "completed", "cancelled", "failed"];

export default function SuperAdminAttacks() {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set("status", statusFilter);
    const r = await fetch(`/api/super-admin/attacks?${params}`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json() as { attacks: Attack[]; total: number };
      setAttacks(d.attacks);
      setTotal(d.total);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function cancelAttack(id: number) {
    const r = await fetch(`/api/super-admin/attacks/${id}/cancel`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (r.ok) { setMsg("Attack cancelled"); load(); }
    else { const d = await r.json() as { error: string }; setMsg("Error: " + d.error); }
    setTimeout(() => setMsg(""), 3000);
  }

  function statusColor(s: string) {
    if (s === "traveling") return "text-yellow-400 bg-yellow-900/20 border-yellow-700/40";
    if (s === "completed") return "text-green-400 bg-green-900/20 border-green-700/40";
    if (s === "cancelled") return "text-slate-400 bg-slate-700/20 border-slate-600/40";
    if (s === "failed") return "text-red-400 bg-red-900/20 border-red-700/40";
    return "text-slate-300";
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-white flex-1">Attacks <span className="text-slate-400 text-base font-normal">({total})</span></h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s ? "bg-[#ef4444] border-[#ef4444] text-white" : "border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-3 py-3">Attacker</th>
                <th className="text-left px-3 py-3">Target</th>
                <th className="text-center px-3 py-3">Status</th>
                <th className="text-right px-3 py-3">Damage</th>
                <th className="text-right px-3 py-3">Arrives</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : attacks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No attacks found</td></tr>
              ) : attacks.map(a => (
                <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-slate-500 text-xs">{a.id}</td>
                  <td className="px-3 py-3 text-white font-medium">{a.attacker_name ?? "?"}</td>
                  <td className="px-3 py-3 text-slate-300">{a.target_name ?? "?"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(a.status)}`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-400 text-xs">
                    {a.damage_dealt != null ? `${a.damage_dealt} dmg` : "—"}
                    {a.target_survived != null && (
                      <span className={`ml-1 ${a.target_survived ? "text-green-400" : "text-red-400"}`}>
                        {a.target_survived ? "(survived)" : "(killed)"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-500 text-xs whitespace-nowrap">
                    {a.travel_arrival_at ? new Date(a.travel_arrival_at).toLocaleString("en-US") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a.status === "traveling" && (
                      <button
                        onClick={() => cancelAttack(a.id)}
                        className="text-xs bg-orange-900/40 hover:bg-orange-800/60 text-orange-400 px-2 py-1 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">← Prev</button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">Next →</button>
        </div>
      </div>
    </AdminLayout>
  );
}
