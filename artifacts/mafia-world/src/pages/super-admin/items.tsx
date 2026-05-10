import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Weapon { id: number; name: string; type: string; attackPower: number; price: number; ammoType: string; description: string; }
interface Armor { id: number; name: string; type: string; defenseBonus: number; price: number; description: string; }
interface Ammo { id: number; name: string; type: string; damageBonus: number; price: number; description: string; }
interface Items { weapons: Weapon[]; armor: Armor[]; ammo: Ammo[]; }

type Tab = "weapons" | "armor" | "ammo";

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

export default function SuperAdminItems() {
  const [items, setItems] = useState<Items | null>(null);
  const [tab, setTab] = useState<Tab>("weapons");
  const [editWeapon, setEditWeapon] = useState<Weapon | null>(null);
  const [editArmor, setEditArmor] = useState<Armor | null>(null);
  const [editAmmo, setEditAmmo] = useState<Ammo | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/super-admin/items", { credentials: "include" });
    if (r.ok) setItems(await r.json() as Items);
  }, []);

  useEffect(() => { load(); }, [load]);

  function notify(m: string) { setMsg(m); setTimeout(() => setMsg(""), 3000); }

  async function saveWeapon(w: Weapon, body: Partial<Weapon>) {
    const r = await fetch(`/api/super-admin/items/weapons/${w.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { notify("Weapon updated"); setEditWeapon(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function saveArmor(a: Armor, body: Partial<Armor>) {
    const r = await fetch(`/api/super-admin/items/armor/${a.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { notify("Armor updated"); setEditArmor(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function saveAmmo(a: Ammo, body: Partial<Ammo>) {
    const r = await fetch(`/api/super-admin/items/ammo/${a.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) { notify("Ammo updated"); setEditAmmo(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "weapons", label: `Weapons (${items?.weapons.length ?? 0})` },
    { key: "armor", label: `Armor (${items?.armor.length ?? 0})` },
    { key: "ammo", label: `Ammo (${items?.ammo.length ?? 0})` },
  ];

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white flex-1">Items Catalog</h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="flex gap-1 bg-[#1e293b] border border-slate-700 rounded-lg p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-[#ef4444] text-white" : "text-slate-400 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!items ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : tab === "weapons" ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-right px-3 py-3">ATK</th>
                  <th className="text-right px-3 py-3">Price</th>
                  <th className="text-left px-3 py-3">Ammo</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.weapons.map(w => (
                  <tr key={w.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium text-white">{w.name}</td>
                    <td className="px-3 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{w.type}</span></td>
                    <td className="px-3 py-3 text-right text-slate-300">{w.attackPower}</td>
                    <td className="px-3 py-3 text-right text-slate-300">${w.price.toLocaleString("en-US")}</td>
                    <td className="px-3 py-3 text-slate-400 text-xs">{w.ammoType}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditWeapon(w)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "armor" ? (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-right px-3 py-3">DEF Bonus</th>
                  <th className="text-right px-3 py-3">Price</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.armor.map(a => (
                  <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                    <td className="px-3 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{a.type}</span></td>
                    <td className="px-3 py-3 text-right text-slate-300">+{a.defenseBonus}</td>
                    <td className="px-3 py-3 text-right text-slate-300">${a.price.toLocaleString("en-US")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditArmor(a)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-right px-3 py-3">DMG Bonus</th>
                  <th className="text-right px-3 py-3">Price</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.ammo.map(a => (
                  <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                    <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                    <td className="px-3 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{a.type}</span></td>
                    <td className="px-3 py-3 text-right text-slate-300">+{a.damageBonus}</td>
                    <td className="px-3 py-3 text-right text-slate-300">${a.price.toLocaleString("en-US")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setEditAmmo(a)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editWeapon && (
        <Modal title={`Edit Weapon: ${editWeapon.name}`} onClose={() => setEditWeapon(null)}>
          <WeaponForm weapon={editWeapon} onSave={(b) => saveWeapon(editWeapon, b)} />
        </Modal>
      )}
      {editArmor && (
        <Modal title={`Edit Armor: ${editArmor.name}`} onClose={() => setEditArmor(null)}>
          <ArmorForm armor={editArmor} onSave={(b) => saveArmor(editArmor, b)} />
        </Modal>
      )}
      {editAmmo && (
        <Modal title={`Edit Ammo: ${editAmmo.name}`} onClose={() => setEditAmmo(null)}>
          <AmmoForm ammo={editAmmo} onSave={(b) => saveAmmo(editAmmo, b)} />
        </Modal>
      )}
    </AdminLayout>
  );
}

function WeaponForm({ weapon, onSave }: { weapon: Weapon; onSave: (b: Partial<Weapon>) => void }) {
  const [name, setName] = useState(weapon.name);
  const [attackPower, setAtk] = useState(weapon.attackPower);
  const [price, setPrice] = useState(weapon.price);
  const [description, setDesc] = useState(weapon.description);
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-slate-400">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Attack Power</label><input type="number" value={attackPower} onChange={e => setAtk(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Price ($)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Description</label><textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none" /></div>
      <button onClick={() => onSave({ name, attackPower, price, description })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium">Save</button>
    </div>
  );
}

function ArmorForm({ armor, onSave }: { armor: Armor; onSave: (b: Partial<Armor>) => void }) {
  const [name, setName] = useState(armor.name);
  const [defenseBonus, setDef] = useState(armor.defenseBonus);
  const [price, setPrice] = useState(armor.price);
  const [description, setDesc] = useState(armor.description);
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-slate-400">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Defense Bonus</label><input type="number" value={defenseBonus} onChange={e => setDef(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Price ($)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Description</label><textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none" /></div>
      <button onClick={() => onSave({ name, defenseBonus, price, description })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium">Save</button>
    </div>
  );
}

function AmmoForm({ ammo, onSave }: { ammo: Ammo; onSave: (b: Partial<Ammo>) => void }) {
  const [name, setName] = useState(ammo.name);
  const [damageBonus, setDmg] = useState(ammo.damageBonus);
  const [price, setPrice] = useState(ammo.price);
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-slate-400">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Damage Bonus</label><input type="number" value={damageBonus} onChange={e => setDmg(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <div><label className="text-xs text-slate-400">Price ($)</label><input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" /></div>
      <button onClick={() => onSave({ name, damageBonus, price })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium">Save</button>
    </div>
  );
}
