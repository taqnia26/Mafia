import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface GangMember { id: number; username: string; gangRank: string | null; }
interface Gang {
  id: number; name: string; description: string | null; treasury: number;
  color: string; bossId: number; bossName: string; memberCount: number;
  members: GangMember[]; createdAt: string;
}

function api(path: string, opts?: RequestInit) {
  return fetch("/api" + path, { credentials: "include", ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1e293b] border border-slate-700 rounded-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SuperAdminGangs() {
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [loading, setLoading] = useState(false);
  const [editGang, setEditGang] = useState<Gang | null>(null);
  const [membersGang, setMembersGang] = useState<Gang | null>(null);
  const [deleteGang, setDeleteGang] = useState<Gang | null>(null);
  const [msg, setMsg] = useState("");

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api("/super-admin/gangs");
    if (r.ok) setGangs(await r.json() as Gang[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveGang(g: Gang, body: Partial<Gang>) {
    const r = await api(`/super-admin/gangs/${g.id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (r.ok) { notify("Gang updated"); setEditGang(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function changeBoss(g: Gang, newBossId: number) {
    const r = await api(`/super-admin/gangs/${g.id}/boss`, { method: "PATCH", body: JSON.stringify({ newBossId }) });
    if (r.ok) { notify("Boss changed"); load(); if (membersGang) { const updated = gangs.find(x => x.id === g.id); setMembersGang(updated ?? null); } }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function kickMember(g: Gang, playerId: number) {
    const r = await api(`/super-admin/gangs/${g.id}/kick/${playerId}`, { method: "POST" });
    if (r.ok) { notify("Member kicked"); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function disbandGang(g: Gang) {
    await api(`/super-admin/gangs/${g.id}`, { method: "DELETE" });
    notify("Gang disbanded"); setDeleteGang(null); load();
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white flex-1">Gangs <span className="text-slate-400 text-base font-normal">({gangs.length})</span></h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left px-4 py-3">Gang</th>
                <th className="text-right px-3 py-3">Members</th>
                <th className="text-right px-3 py-3">Treasury</th>
                <th className="text-left px-3 py-3">Boss</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : gangs.map(g => (
                <tr key={g.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
                      <div>
                        <div className="font-medium text-white">{g.name}</div>
                        {g.description && <div className="text-xs text-slate-500 truncate max-w-xs">{g.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">{g.memberCount}</td>
                  <td className="px-3 py-3 text-right text-slate-300">${g.treasury.toLocaleString()}</td>
                  <td className="px-3 py-3 text-slate-300">{g.bossName}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setEditGang(g)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                      <button onClick={() => setMembersGang(g)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Members</button>
                      <button onClick={() => setDeleteGang(g)} className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 px-2 py-1 rounded">Disband</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editGang && (
        <Modal title={`Edit "${editGang.name}"`} onClose={() => setEditGang(null)}>
          <EditGangForm gang={editGang} onSave={(b) => saveGang(editGang, b)} />
        </Modal>
      )}

      {membersGang && (
        <Modal title={`Members — ${membersGang.name}`} onClose={() => setMembersGang(null)}>
          <div className="space-y-2">
            {membersGang.members.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No members</p>
            ) : membersGang.members.map(m => (
              <div key={m.id} className="flex items-center gap-2 py-2 border-b border-slate-700/50">
                <span className={`text-xs px-1.5 py-0.5 rounded ${m.id === membersGang.bossId ? "bg-yellow-900/30 text-yellow-400" : "bg-slate-700/50 text-slate-400"}`}>
                  {m.gangRank ?? "Member"}
                </span>
                <span className="flex-1 text-sm text-white">{m.username}</span>
                <div className="flex gap-1">
                  {m.id !== membersGang.bossId && (
                    <button
                      onClick={() => changeBoss(membersGang, m.id)}
                      className="text-xs bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-400 px-2 py-1 rounded transition-colors"
                      title="Make Boss"
                    >
                      👑
                    </button>
                  )}
                  {m.id !== membersGang.bossId && (
                    <button
                      onClick={() => kickMember(membersGang, m.id)}
                      className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 px-2 py-1 rounded transition-colors"
                    >
                      Kick
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {deleteGang && (
        <Modal title={`Disband "${deleteGang.name}"?`} onClose={() => setDeleteGang(null)}>
          <p className="text-sm text-slate-300 mb-4">All {deleteGang.memberCount} members will lose their gang affiliation. This cannot be undone.</p>
          <button onClick={() => disbandGang(deleteGang)} className="w-full bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Disband Gang</button>
        </Modal>
      )}
    </AdminLayout>
  );
}

function EditGangForm({ gang, onSave }: { gang: Gang; onSave: (b: Partial<Gang>) => void }) {
  const [name, setName] = useState(gang.name);
  const [description, setDescription] = useState(gang.description ?? "");
  const [treasury, setTreasury] = useState(gang.treasury);
  const [color, setColor] = useState(gang.color);
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-slate-400">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none" /></div>
      <div><label className="text-xs text-slate-400">Treasury ($)</label><input type="number" value={treasury} onChange={e => setTreasury(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Color</label><input type="color" value={color} onChange={e => setColor(e.target.value)} className="mt-1 w-10 h-8 rounded cursor-pointer" /></div>
      <button onClick={() => onSave({ name, description, treasury, color })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium mt-2">Save Changes</button>
    </div>
  );
}
