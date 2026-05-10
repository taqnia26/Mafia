import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface CrimeType {
  id: number; name: string; description: string;
  minReward: number; maxReward: number; xpReward: number;
  successRate: number; cooldownMinutes: number; prisonTimeHours: number; requiredLevel: number;
}

export default function SuperAdminCrimes() {
  const [crimes, setCrimes] = useState<CrimeType[]>([]);
  const [editing, setEditing] = useState<CrimeType | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/super-admin/crimes", { credentials: "include" });
    if (r.ok) setCrimes(await r.json() as CrimeType[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(c: CrimeType, body: Partial<CrimeType>) {
    const r = await fetch(`/api/super-admin/crimes/${c.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { setMsg("Saved"); setEditing(null); load(); }
    else { const d = await r.json() as { error: string }; setMsg("Error: " + d.error); }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Crime Types</h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="grid gap-3">
          {crimes.map(c => (
            <div key={c.id} className="bg-[#1e293b] border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{c.name}</span>
                    <span className="text-xs text-slate-500">Lv.{c.requiredLevel}+</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400">
                    <span>💰 ${c.minReward.toLocaleString("en-US")}–${c.maxReward.toLocaleString("en-US")}</span>
                    <span>⭐ {c.xpReward} XP</span>
                    <span>✅ {(c.successRate * 100).toFixed(0)}%</span>
                    <span>⏱ {c.cooldownMinutes}min CD</span>
                    <span>🔒 {c.prisonTimeHours}h jail</span>
                  </div>
                </div>
                <button onClick={() => setEditing(c)} className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors">Edit</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <CrimeEditModal crime={editing} onSave={(b) => save(editing, b)} onClose={() => setEditing(null)} />
      )}
    </AdminLayout>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1e293b] border border-slate-700 rounded-xl w-full max-w-sm p-5 max-h-[calc(100vh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CrimeEditModal({ crime, onSave, onClose }: { crime: CrimeType; onSave: (b: Partial<CrimeType>) => void; onClose: () => void }) {
  const [minReward, setMin] = useState(crime.minReward);
  const [maxReward, setMax] = useState(crime.maxReward);
  const [xpReward, setXp] = useState(crime.xpReward);
  const [successRate, setRate] = useState(crime.successRate * 100);
  const [cooldown, setCooldown] = useState(crime.cooldownMinutes);
  const [prisonTime, setPrison] = useState(crime.prisonTimeHours);

  return (
    <Modal title={`Edit: ${crime.name}`} onClose={onClose}>
      <div className="space-y-3">
        {[
          ["Min Reward", minReward, setMin],
          ["Max Reward", maxReward, setMax],
          ["XP Reward", xpReward, setXp],
          ["Success Rate %", successRate, setRate],
          ["Cooldown (min)", cooldown, setCooldown],
          ["Prison Time (h)", prisonTime, setPrison],
        ].map(([label, val, setter]) => (
          <div key={String(label)}>
            <label className="text-xs text-slate-400">{String(label)}</label>
            <input type="number" value={Number(val)} onChange={e => (setter as (n: number) => void)(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
          </div>
        ))}
        <button
          onClick={() => onSave({ minReward, maxReward, xpReward, successRate: successRate / 100, cooldownMinutes: cooldown, prisonTimeHours: prisonTime })}
          className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium mt-2"
        >Save Changes</button>
      </div>
    </Modal>
  );
}
