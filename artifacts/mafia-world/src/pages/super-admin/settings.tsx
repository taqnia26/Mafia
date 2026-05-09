import { useEffect, useState } from "react";
import { AdminLayout } from "./layout";

interface GameSettings {
  xpMultiplier: number;
  moneyMultiplier: number;
  crimeSuccessBonus: number;
}

export default function SuperAdminSettings() {
  const [settings, setSettings] = useState<GameSettings>({ xpMultiplier: 1, moneyMultiplier: 1, crimeSuccessBonus: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/super-admin/settings", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSettings(d as GameSettings))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/super-admin/settings", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (r.ok) {
      const d = await r.json() as GameSettings;
      setSettings(d);
      setMsg("Settings saved");
    } else {
      setMsg("Failed to save");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-lg">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Economy Settings</h1>
          {msg && <span className={`text-xs px-2 py-1 rounded ${msg.includes("Failed") ? "text-red-400 bg-red-900/20" : "text-green-400 bg-green-900/20"}`}>{msg}</span>}
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-white mb-1 block">XP Multiplier</label>
              <p className="text-xs text-slate-400 mb-2">Multiplies XP earned from crimes and attacks. Default: 1.0</p>
              <input
                type="number" step="0.1" min="0.1" max="10"
                value={settings.xpMultiplier}
                onChange={e => setSettings(s => ({ ...s, xpMultiplier: Number(e.target.value) }))}
                className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ef4444] w-40"
              />
            </div>

            <div className="border-t border-slate-700 pt-5">
              <label className="text-sm font-medium text-white mb-1 block">Money Multiplier</label>
              <p className="text-xs text-slate-400 mb-2">Multiplies money rewards from crimes. Default: 1.0</p>
              <input
                type="number" step="0.1" min="0.1" max="10"
                value={settings.moneyMultiplier}
                onChange={e => setSettings(s => ({ ...s, moneyMultiplier: Number(e.target.value) }))}
                className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ef4444] w-40"
              />
            </div>

            <div className="border-t border-slate-700 pt-5">
              <label className="text-sm font-medium text-white mb-1 block">Crime Success Bonus</label>
              <p className="text-xs text-slate-400 mb-2">Flat bonus added to crime success rates. Range: -0.5 to +0.5</p>
              <input
                type="number" step="0.01" min="-0.5" max="0.5"
                value={settings.crimeSuccessBonus}
                onChange={e => setSettings(s => ({ ...s, crimeSuccessBonus: Number(e.target.value) }))}
                className="bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ef4444] w-40"
              />
            </div>

            <div className="border-t border-slate-700 pt-5">
              <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-400">⚠ These settings are held in memory. They reset when the server restarts. A persistent settings table can be added in a future task.</p>
              </div>
              <button
                onClick={save} disabled={saving}
                className="bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
