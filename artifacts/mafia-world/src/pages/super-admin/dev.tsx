import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./layout";

interface SqlResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: { name: string }[];
  error?: string;
  requiresConfirm?: boolean;
}

interface LogEntry { ts: string; level: string; source: string; message: string; }

interface SeedResult { ok: boolean; affected: number | null; message?: string; error?: string; }

const SEED_ACTIONS: { action: string; label: string; description: string; danger?: boolean }[] = [
  { action: "reset-player-money", label: "Top Up Broke Players", description: "Give $5,000 to all players with less than $100" },
  { action: "release-all-prison", label: "Release All Prisoners", description: "Free everyone currently in jail", danger: true },
  { action: "cancel-traveling-attacks", label: "Cancel All In-Flight Attacks", description: "Cancel all attacks currently traveling", danger: true },
];

export default function SuperAdminDev() {
  const [query, setQuery] = useState("SELECT username, level, money FROM players ORDER BY level DESC LIMIT 20;");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [tab, setTab] = useState<"sql" | "seed" | "logs">("sql");

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const r = await fetch("/api/super-admin/dev/logs", { credentials: "include" });
    if (r.ok) setLogs(await r.json() as LogEntry[]);
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "logs") loadLogs();
  }, [tab, loadLogs]);

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

  async function runSeedAction(action: string) {
    setSeedMsg("Running...");
    const r = await fetch("/api/super-admin/dev/seed-data", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json() as SeedResult;
    setSeedMsg(d.message ?? d.error ?? (d.ok ? "Done" : "Failed"));
    setTimeout(() => setSeedMsg(""), 5000);
  }

  const QUICK_QUERIES = [
    "SELECT username, level, money FROM players ORDER BY level DESC LIMIT 10",
    "SELECT * FROM gangs ORDER BY treasury DESC",
    "SELECT name, success_rate, min_reward, max_reward FROM crime_types",
    "SELECT COUNT(*) as total, status FROM attacks GROUP BY status",
    "SELECT username, is_banned, ban_reason FROM players WHERE is_banned = TRUE",
  ];

  function levelColor(level: string) {
    if (level === "INFO") return "text-blue-400";
    if (level === "WARN") return "text-yellow-400";
    if (level === "ERROR") return "text-red-400";
    if (level === "ADMIN") return "text-purple-400";
    return "text-slate-400";
  }

  return (
    <AdminLayout>
      <div className="space-y-4 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-white">Dev Tools</h1>
          <p className="text-xs text-slate-400 mt-1">SQL console, data operations, and server logs.</p>
        </div>

        <div className="flex gap-1 bg-[#1e293b] border border-slate-700 rounded-lg p-1 w-fit">
          {(["sql", "seed", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-[#ef4444] text-white" : "text-slate-400 hover:text-white"}`}>
              {t === "sql" ? "SQL Console" : t === "seed" ? "Data Tools" : "Server Logs"}
            </button>
          ))}
        </div>

        {tab === "sql" && (
          <div className="space-y-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Quick Queries</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUERIES.map(q => (
                    <button key={q} onClick={() => setQuery(q)} className="text-xs text-slate-500 hover:text-slate-300 bg-slate-700/50 px-2 py-1 rounded transition-colors truncate max-w-[200px]">{q.slice(0, 40)}…</button>
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
                ) : result.rows.length > 0 ? (
                  <>
                    <div className="text-xs text-slate-400 mb-3">{result.rowCount ?? result.rows.length} row(s)</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-700">
                            {result.fields.map(f => <th key={f.name} className="text-left px-3 py-2 text-slate-400 font-mono">{f.name}</th>)}
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
                  </>
                ) : (
                  <div className="text-slate-500 text-sm">Query executed. No rows returned.</div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "seed" && (
          <div className="space-y-3">
            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 text-xs text-yellow-400">
              ⚠ These operations modify game data directly. Dangerous actions cannot be undone.
            </div>
            {seedMsg && (
              <div className="bg-green-900/20 border border-green-700/40 rounded-lg px-4 py-2 text-sm text-green-400">{seedMsg}</div>
            )}
            {SEED_ACTIONS.map(action => (
              <div key={action.action} className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-white text-sm">{action.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{action.description}</div>
                </div>
                <button
                  onClick={() => runSeedAction(action.action)}
                  className={`shrink-0 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${action.danger ? "bg-red-900/50 hover:bg-red-700 text-red-300" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
                >
                  Run
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "logs" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{logs.length} entries</span>
              <button onClick={loadLogs} disabled={logsLoading} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                {logsLoading ? "Refreshing..." : "↺ Refresh"}
              </button>
            </div>
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-slate-500 text-center py-8">No log entries</div>
                ) : logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2 border-b border-slate-700/30 hover:bg-slate-700/10">
                    <span className="text-slate-600 shrink-0 w-20 text-right">{new Date(log.ts).toLocaleTimeString()}</span>
                    <span className={`shrink-0 w-12 ${levelColor(log.level)}`}>{log.level}</span>
                    <span className="text-slate-500 shrink-0">[{log.source}]</span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
