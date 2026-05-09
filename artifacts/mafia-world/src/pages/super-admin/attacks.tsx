import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Attack {
  id: number; status: string; outcome: string | null;
  attacker_name: string; target_name: string;
  created_at: string; arrives_at: string | null;
}

export default function SuperAdminAttacks() {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/super-admin/attacks?page=${page}`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json() as { attacks: Attack[]; total: number };
      setAttacks(d.attacks);
      setTotal(d.total);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function statusColor(s: string) {
    if (s === "pending") return "text-yellow-400 bg-yellow-900/20 border-yellow-700/40";
    if (s === "resolved") return "text-green-400 bg-green-900/20 border-green-700/40";
    if (s === "cancelled") return "text-slate-400 bg-slate-700/20 border-slate-600/40";
    return "text-slate-300";
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-white">Attacks <span className="text-slate-400 text-base font-normal">({total})</span></h1>

        <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-3 py-3">Attacker</th>
                <th className="text-left px-3 py-3">Target</th>
                <th className="text-center px-3 py-3">Status</th>
                <th className="text-left px-3 py-3">Outcome</th>
                <th className="text-right px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : attacks.map(a => (
                <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 text-slate-500">{a.id}</td>
                  <td className="px-3 py-3 text-white font-medium">{a.attacker_name ?? "?"}</td>
                  <td className="px-3 py-3 text-slate-300">{a.target_name ?? "?"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(a.status)}`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs">{a.outcome ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-500 text-xs">{new Date(a.created_at).toLocaleString()}</td>
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
