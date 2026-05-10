import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface City {
  id: number; name: string; nameAr: string; country: string;
  description: string; travelHoursBase: number;
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

export default function SuperAdminCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [editing, setEditing] = useState<City | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/super-admin/cities", { credentials: "include" });
    if (r.ok) setCities(await r.json() as City[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(c: City, body: Partial<City>) {
    const r = await fetch(`/api/super-admin/cities/${c.id}`, {
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
          <h1 className="text-xl font-bold text-white">Cities</h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="grid gap-3">
          {cities.map(c => (
            <div key={c.id} className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="text-slate-400 text-sm">{c.nameAr}</span>
                  <span className="text-xs text-slate-500">{c.country}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                <div className="text-xs text-slate-500 mt-1">✈ {c.travelHoursBase}h base travel</div>
              </div>
              <button onClick={() => setEditing(c)} className="shrink-0 text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded">Edit</button>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <CityForm city={editing} onSave={(b) => save(editing, b)} />
        </Modal>
      )}
    </AdminLayout>
  );
}

function CityForm({ city, onSave }: { city: City; onSave: (b: Partial<City>) => void }) {
  const [name, setName] = useState(city.name);
  const [nameAr, setNameAr] = useState(city.nameAr);
  const [description, setDesc] = useState(city.description);
  const [travelHours, setTravel] = useState(city.travelHoursBase);

  return (
    <div className="space-y-3">
      <div><label className="text-xs text-slate-400">Name (EN)</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Name (AR)</label><input value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Description</label><textarea value={description} onChange={e => setDesc(e.target.value)} rows={3} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none" /></div>
      <div><label className="text-xs text-slate-400">Travel Hours (base)</label><input type="number" min={1} max={72} value={travelHours} onChange={e => setTravel(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <button onClick={() => onSave({ name, nameAr, description, travelHoursBase: travelHours })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium mt-2">Save</button>
    </div>
  );
}
