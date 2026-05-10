import { useEffect, useState } from "react";
import { AdminLayout } from "./layout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface Stats {
  totalPlayers: number;
  totalGangs: number;
  totalPrisoners: number;
  attacksToday: number;
  totalMoneyInCirculation: number;
  attacksByDay: { day: string; count: number }[];
  crimesByType: { name: string; count: number }[];
  topPlayers: { id: number; username: string; level: number; killCount: number; money: number }[];
  recentActivity: { id: number; type: string; description: string; createdAt: string; username: string | null }[];
}

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString("en-US") : value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/stats", { credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        setStats({
          totalPlayers: d.totalPlayers ?? 0,
          totalGangs: d.totalGangs ?? 0,
          totalPrisoners: d.totalPrisoners ?? 0,
          attacksToday: d.attacksToday ?? 0,
          totalMoneyInCirculation: d.totalMoneyInCirculation ?? 0,
          attacksByDay: Array.isArray(d.attacksByDay) ? d.attacksByDay : [],
          crimesByType: Array.isArray(d.crimesByType) ? d.crimesByType : [],
          topPlayers: Array.isArray(d.topPlayers) ? d.topPlayers : [],
          recentActivity: Array.isArray(d.recentActivity) ? d.recentActivity : [],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time game overview</p>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm py-8 text-center">Loading stats...</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Players" value={stats.totalPlayers} />
              <StatCard label="Gangs" value={stats.totalGangs} />
              <StatCard label="In Prison" value={stats.totalPrisoners} />
              <StatCard label="Attacks Today" value={stats.attacksToday} />
              <StatCard label="Money in Circulation" value={"$" + (stats.totalMoneyInCirculation / 1_000_000).toFixed(1) + "M"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Attacks (Last 7 Days)</h3>
                {stats.attacksByDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={stats.attacksByDay}>
                      <XAxis dataKey="day" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                      <Bar dataKey="count" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-10">No attack data</div>
                )}
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Crime Distribution (7 Days)</h3>
                {stats.crimesByType.some(c => c.count > 0) ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.crimesByType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {stats.crimesByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-slate-500 text-sm text-center py-10">No crime data</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Top Players</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2">Username</th>
                      <th className="text-right py-2">Level</th>
                      <th className="text-right py-2">Kills</th>
                      <th className="text-right py-2">Money</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topPlayers.map(p => (
                      <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="py-2 text-white font-medium">{p.username}</td>
                        <td className="py-2 text-right text-slate-300">{p.level}</td>
                        <td className="py-2 text-right text-slate-300">{p.killCount}</td>
                        <td className="py-2 text-right text-slate-300">${p.money.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.recentActivity.map(e => (
                    <div key={e.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-700/50">
                      <span className="text-slate-500 shrink-0 mt-0.5">{new Date(e.createdAt).toLocaleTimeString()}</span>
                      <div>
                        <span className="text-slate-400">{e.username ?? "?"} — </span>
                        <span className="text-slate-300">{e.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-slate-400 text-sm">Failed to load stats</div>
        )}
      </div>
    </AdminLayout>
  );
}
