import { useState } from "react";
import { AdminLayout } from "./layout";

interface SqlResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: { name: string }[];
  error?: string;
  requiresConfirm?: boolean;
}

export default function SuperAdminDev() {
  const [query, setQuery] = useState("SELECT username, level, money FROM players ORDER BY level DESC LIMIT 20;");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  async function runQuery(q: string, withConfirm = false) {
    setLoading(true);
    setResult(null);
    const r = await fetch("/api/super-admin/dev/sql", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, confirm: withConfirm }),
    });
    const d = await r.json() as SqlResult;
    if (!r.ok && d.requiresConfirm) {
      setPendingQuery(q);
      setConfirm(true);
      setResult({ rows: [], rowCount: null, fields: [], error: d.error });
    } else {
      setResult(d);
      setConfirm(false);
      setPendingQuery(null);
    }
    setLoading(false);
  }

  async function confirmRun() {
    if (!pendingQuery) return;
    setConfirm(false);
    await runQuery(pendingQuery, true);
    setPendingQuery(null);
  }

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-white">Dev Tools — SQL Console</h1>
          <p className="text-xs text-slate-400 mt-1">Direct database access. Destructive queries require explicit confirmation.</p>
        </div>

        <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-400 uppercase tracking-wider">SQL Query</label>
            <div className="flex gap-2">
              {["SELECT * FROM players LIMIT 10", "SELECT * FROM gangs", "SELECT COUNT(*) FROM attacks"].map(q => (
                <button key={q} onClick={() => setQuery(q)} className="text-xs text-slate-500 hover:text-slate-300 bg-slate-700/50 px-2 py-1 rounded transition-colors">{q.slice(0, 20)}…</button>
              ))}
            </div>
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={5}
            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#ef4444] resize-y"
            placeholder="SELECT ..."
            spellCheck={false}
          />
          <button
            onClick={() => runQuery(query)}
            disabled={loading || !query.trim()}
            className="bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Running..." : "▶ Run Query"}
          </button>
        </div>

        {confirm && (
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-4">
            <p className="text-red-400 font-medium text-sm mb-1">⚠ Dangerous Query Detected</p>
            <p className="text-red-300 text-xs mb-3">{result?.error}</p>
            <p className="text-slate-300 text-xs mb-3">The query may modify or delete data. Confirm to proceed.</p>
            <div className="flex gap-2">
              <button onClick={confirmRun} className="bg-red-700 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg">Confirm & Run</button>
              <button onClick={() => { setConfirm(false); setPendingQuery(null); setResult(null); }} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {result && !confirm && (
          <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-4">
            {result.error ? (
              <div className="text-red-400 text-sm font-mono">{result.error}</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400">{result.rowCount ?? result.rows.length} row(s) returned</span>
                </div>
                {result.rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {result.fields.map(f => (
                            <th key={f.name} className="text-left px-3 py-2 text-slate-400 font-mono">{f.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            {result.fields.map(f => (
                              <td key={f.name} className="px-3 py-2 text-slate-300 font-mono whitespace-nowrap max-w-xs truncate">
                                {row[f.name] === null ? <span className="text-slate-600">NULL</span> : String(row[f.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">Query executed successfully. No rows returned.</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
