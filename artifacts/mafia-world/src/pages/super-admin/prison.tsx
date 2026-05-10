import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Prisoner {
  id: number; username: string; level: number;
  prisonReleaseAt: string | null; prisonCrime: string | null;
}

export default function SuperAdminPrison() {
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/super-admin/prison", { credentials: "include" });
    if (r.ok) setPrisoners(await r.json() as Prisoner[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function release(p: Prisoner) {
    await fetch(`/api/super-admin/players/${p.id}/prison`, { method: "DELETE", credentials: "include" });
    setMsg(`Released ${p.username}`);
    load();
  }

  function timeLeft(releaseAt: string | null): string {
    if (!releaseAt) return "—";
    const ms = new Date(releaseAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Prison <span className="text-slate-400 text-base font-normal">({prisoners.length} inmates)</span></h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        {prisoners.length === 0 && !loading ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 py-12 text-center text-slate-500">No players in prison</div>
        ) : (
          <>
          {/* Mobile card stack */}
          <div className="md:hidden space-y-2">
            {loading ? (
              <div className="bg-[#1e293b] rounded-xl border border-slate-700 py-8 text-center text-slate-500 text-sm">Loading...</div>
            ) : prisoners.map(p => (
              <div key={p.id} className="bg-[#1e293b] rounded-xl border border-slate-700 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white text-sm truncate">{p.username} <span className="text-xs text-slate-500">Lvl {p.level}</span></p>
                    <p className="text-xs text-slate-500 truncate">{p.prisonCrime ?? "—"}</p>
                  </div>
                  <span className="text-orange-400 text-xs font-mono shrink-0">{timeLeft(p.prisonReleaseAt)}</span>
                </div>
                <button onClick={() => release(p)} className="mt-2 text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded w-full">Release</button>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-3 py-3">Level</th>
                  <th className="text-left px-3 py-3">Crime</th>
                  <th className="text-right px-3 py-3">Time Left</th>
                  <th className="text-right px-4 py-3">Release</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
                ) : prisoners.map(p => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium text-white">{p.username}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{p.level}</td>
                    <td className="px-3 py-3 text-slate-400 text-xs">{p.prisonCrime ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-orange-400 text-xs font-mono">{timeLeft(p.prisonReleaseAt)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => release(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded transition-colors">Release</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
