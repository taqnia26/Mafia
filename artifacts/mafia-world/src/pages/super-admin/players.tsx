import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Player {
  id: number; username: string; level: number; xp: number; money: number;
  attackPower: number; defensePower: number; killCount: number; deathCount: number;
  isInPrison: boolean; prisonReleaseAt: string | null; isAdmin: boolean;
  adminRole: string | null; gangId: number | null; createdAt: string;
  cityName: string; isBanned: boolean; banReason: string | null;
  isPermanentlyDead?: boolean; diedAt?: string | null; deathCause?: string | null;
  isChatMuted?: boolean;
}

type Dialog =
  | { type: "edit"; player: Player }
  | { type: "add-money"; player: Player }
  | { type: "jail"; player: Player }
  | { type: "ban"; player: Player }
  | { type: "delete"; player: Player }
  | { type: "reset"; player: Player }
  | { type: "revive"; player: Player }
  | { type: "chat-mute"; player: Player }
  | null;

function api(path: string, opts?: RequestInit) {
  return fetch("/api" + path, { credentials: "include", ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
}

export default function SuperAdminPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [prisonFilter, setPrisonFilter] = useState(false);
  const [bannedFilter, setBannedFilter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [msg, setMsg] = useState("");

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (prisonFilter) params.set("prisonFilter", "true");
    if (bannedFilter) params.set("bannedFilter", "true");
    const r = await api(`/super-admin/players?${params}`);
    if (r.ok) {
      const d = await r.json() as { players: Player[]; total: number };
      setPlayers(d.players);
      setTotal(d.total);
    }
    setLoading(false);
  }, [page, search, prisonFilter, bannedFilter]);

  useEffect(() => { load(); }, [load]);

  async function editPlayer(p: Player, body: Record<string, unknown>) {
    const r = await api(`/super-admin/players/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (r.ok) { notify("Updated"); setDialog(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function addMoney(p: Player, amount: number) {
    await api(`/super-admin/players/${p.id}/add-money`, { method: "POST", body: JSON.stringify({ amount }) });
    notify("Money adjusted"); setDialog(null); load();
  }

  async function jailPlayer(p: Player, hours: number) {
    await api(`/super-admin/players/${p.id}/prison`, { method: "POST", body: JSON.stringify({ hours }) });
    notify("Jailed"); setDialog(null); load();
  }

  async function releasePlayer(p: Player) {
    await api(`/super-admin/players/${p.id}/prison`, { method: "DELETE" });
    notify("Released"); load();
  }

  async function banPlayer(p: Player, reason: string) {
    await api(`/super-admin/players/${p.id}/ban`, { method: "POST", body: JSON.stringify({ reason }) });
    notify("Player banned"); setDialog(null); load();
  }

  async function unbanPlayer(p: Player) {
    await api(`/super-admin/players/${p.id}/ban`, { method: "DELETE" });
    notify("Player unbanned"); load();
  }

  async function deletePlayer(p: Player) {
    const r = await api(`/super-admin/players/${p.id}`, { method: "DELETE" });
    if (r.ok) { notify("Deleted"); setDialog(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function resetPlayer(p: Player) {
    await api(`/super-admin/players/${p.id}/reset`, { method: "POST" });
    notify("Reset"); setDialog(null); load();
  }

  async function muteChat(p: Player, channel: string, durationHours: number | null, reason: string) {
    const r = await api(`/super-admin/players/${p.id}/chat-mute`, {
      method: "POST",
      body: JSON.stringify({ channel, durationHours: durationHours ?? undefined, reason: reason || undefined }),
    });
    if (r.ok) { notify("Chat muted"); setDialog(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function unmuteChat(p: Player) {
    const r = await api(`/super-admin/players/${p.id}/chat-mute`, { method: "DELETE" });
    if (r.ok) { notify("Chat unmuted"); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  async function revivePlayer(p: Player) {
    const r = await api(`/super-admin/players/${p.id}/revive`, { method: "POST" });
    if (r.ok) { notify("Revived"); setDialog(null); load(); }
    else { const d = await r.json() as { error: string }; notify("Error: " + d.error); }
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-white flex-1">Players <span className="text-slate-400 text-base font-normal">({total})</span></h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search username..."
            className="bg-[#1e293b] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#ef4444] w-56"
          />
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input type="checkbox" checked={prisonFilter} onChange={e => { setPrisonFilter(e.target.checked); setPage(1); }} className="accent-[#ef4444]" />
            In Prison
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input type="checkbox" checked={bannedFilter} onChange={e => { setBannedFilter(e.target.checked); setPage(1); }} className="accent-[#ef4444]" />
            Banned
          </label>
        </div>

        {/* Mobile card stack */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="bg-[#1e293b] rounded-xl border border-slate-700 py-8 text-center text-slate-500 text-sm">Loading...</div>
          ) : players.map(p => (
            <div key={p.id} className={`bg-[#1e293b] rounded-xl border border-slate-700 p-3 ${p.isBanned ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white text-sm flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{p.username}</span>
                    {p.isBanned && <span className="text-xs bg-red-900/50 text-red-400 border border-red-700/40 px-1.5 py-0.5 rounded">banned</span>}
                    {p.isPermanentlyDead && <span className="text-xs bg-red-950/70 text-red-300 border border-red-800/60 px-1.5 py-0.5 rounded">💀</span>}
                  </div>
                  <div className="text-xs text-slate-500">{p.cityName} • Lvl {p.level}</div>
                </div>
                {p.isPermanentlyDead ? (
                  <span className="text-xs bg-red-950/60 text-red-300 border border-red-800/60 px-2 py-0.5 rounded-full shrink-0">DEAD</span>
                ) : p.isInPrison ? (
                  <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-700/50 px-2 py-0.5 rounded-full shrink-0">Prison</span>
                ) : (
                  <span className="text-xs bg-green-900/20 text-green-400 border border-green-700/30 px-2 py-0.5 rounded-full shrink-0">Active</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div><span className="text-slate-500">$</span> <span className="text-slate-300 font-mono">{p.money.toLocaleString()}</span></div>
                <div><span className="text-slate-500">K/D</span> <span className="text-slate-300 font-mono">{p.killCount}/{p.deathCount}</span></div>
                <div><span className="text-slate-500">A/D</span> <span className="text-slate-300 font-mono">{p.attackPower}/{p.defensePower}</span></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button onClick={() => setDialog({ type: "edit", player: p })} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                <button onClick={() => setDialog({ type: "add-money", player: p })} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">💰</button>
                {p.isInPrison
                  ? <button onClick={() => releasePlayer(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Release</button>
                  : <button onClick={() => setDialog({ type: "jail", player: p })} className="text-xs bg-orange-900/50 hover:bg-orange-800 text-orange-300 px-2 py-1 rounded">Jail</button>}
                {p.isBanned
                  ? <button onClick={() => unbanPlayer(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Unban</button>
                  : <button onClick={() => setDialog({ type: "ban", player: p })} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-400 px-2 py-1 rounded">Ban</button>}
                {p.isChatMuted
                  ? <button onClick={() => unmuteChat(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Unmute</button>
                  : <button onClick={() => setDialog({ type: "chat-mute", player: p })} className="text-xs bg-purple-900/40 hover:bg-purple-800 text-purple-300 px-2 py-1 rounded">Mute</button>}
                {p.isPermanentlyDead && (
                  <button onClick={() => setDialog({ type: "revive", player: p })} className="text-xs bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 px-2 py-1 rounded">Revive</button>
                )}
                <button onClick={() => setDialog({ type: "reset", player: p })} className="text-xs bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-400 px-2 py-1 rounded">Reset</button>
                <button onClick={() => setDialog({ type: "delete", player: p })} className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 px-2 py-1 rounded">Del</button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left px-4 py-3">Player</th>
                <th className="text-right px-3 py-3">Lvl</th>
                <th className="text-right px-3 py-3">Money</th>
                <th className="text-right px-3 py-3">K/D</th>
                <th className="text-right px-3 py-3">ATK/DEF</th>
                <th className="text-center px-3 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : players.map(p => (
                <tr key={p.id} className={`border-b border-slate-700/50 hover:bg-slate-700/20 ${p.isBanned ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white flex items-center gap-1.5">
                      {p.username}
                      {p.isBanned && <span className="text-xs bg-red-900/50 text-red-400 border border-red-700/40 px-1.5 py-0.5 rounded">banned</span>}
                      {p.isPermanentlyDead && <span className="text-xs bg-red-950/70 text-red-300 border border-red-800/60 px-1.5 py-0.5 rounded">💀 dead</span>}
                    </div>
                    <div className="text-xs text-slate-500">{p.cityName}</div>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">{p.level}</td>
                  <td className="px-3 py-3 text-right text-slate-300">${p.money.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-slate-300">{p.killCount}/{p.deathCount}</td>
                  <td className="px-3 py-3 text-right text-slate-300">{p.attackPower}/{p.defensePower}</td>
                  <td className="px-3 py-3 text-center">
                    {p.isPermanentlyDead ? (
                      <span className="text-xs bg-red-950/60 text-red-300 border border-red-800/60 px-2 py-0.5 rounded-full">DEAD</span>
                    ) : p.isInPrison ? (
                      <span className="text-xs bg-orange-900/30 text-orange-400 border border-orange-700/50 px-2 py-0.5 rounded-full">Prison</span>
                    ) : (
                      <span className="text-xs bg-green-900/20 text-green-400 border border-green-700/30 px-2 py-0.5 rounded-full">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <button onClick={() => setDialog({ type: "edit", player: p })} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Edit</button>
                      <button onClick={() => setDialog({ type: "add-money", player: p })} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">💰</button>
                      {p.isInPrison
                        ? <button onClick={() => releasePlayer(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Release</button>
                        : <button onClick={() => setDialog({ type: "jail", player: p })} className="text-xs bg-orange-900/50 hover:bg-orange-800 text-orange-300 px-2 py-1 rounded">Jail</button>
                      }
                      {p.isBanned
                        ? <button onClick={() => unbanPlayer(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Unban</button>
                        : <button onClick={() => setDialog({ type: "ban", player: p })} className="text-xs bg-red-900/40 hover:bg-red-800 text-red-400 px-2 py-1 rounded">Ban</button>
                      }
                      {p.isChatMuted
                        ? <button onClick={() => unmuteChat(p)} className="text-xs bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-1 rounded">Unmute</button>
                        : <button onClick={() => setDialog({ type: "chat-mute", player: p })} className="text-xs bg-purple-900/40 hover:bg-purple-800 text-purple-300 px-2 py-1 rounded">Mute</button>
                      }
                      {p.isPermanentlyDead && (
                        <button onClick={() => setDialog({ type: "revive", player: p })} className="text-xs bg-emerald-800/50 hover:bg-emerald-700 text-emerald-200 px-2 py-1 rounded">Revive</button>
                      )}
                      <button onClick={() => setDialog({ type: "reset", player: p })} className="text-xs bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-400 px-2 py-1 rounded">Reset</button>
                      <button onClick={() => setDialog({ type: "delete", player: p })} className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 px-2 py-1 rounded">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">← Prev</button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs">Next →</button>
        </div>
      </div>

      {dialog?.type === "edit" && <EditPlayerDialog player={dialog.player} onSave={(b) => editPlayer(dialog.player, b)} onClose={() => setDialog(null)} />}
      {dialog?.type === "add-money" && <AddMoneyDialog player={dialog.player} onSave={(a) => addMoney(dialog.player, a)} onClose={() => setDialog(null)} />}
      {dialog?.type === "jail" && <JailDialog player={dialog.player} onJail={(h) => jailPlayer(dialog.player, h)} onClose={() => setDialog(null)} />}
      {dialog?.type === "ban" && <BanDialog player={dialog.player} onBan={(r) => banPlayer(dialog.player, r)} onClose={() => setDialog(null)} />}
      {dialog?.type === "delete" && <ConfirmDialog title={`Delete ${dialog.player.username}?`} message="This permanently deletes the player and all their data." confirmLabel="Delete Player" danger onConfirm={() => deletePlayer(dialog.player)} onClose={() => setDialog(null)} />}
      {dialog?.type === "reset" && <ConfirmDialog title={`Reset ${dialog.player.username}?`} message="Resets money, level, stats to defaults. Cannot be undone." confirmLabel="Reset Stats" onConfirm={() => resetPlayer(dialog.player)} onClose={() => setDialog(null)} />}
      {dialog?.type === "chat-mute" && <ChatMuteDialog player={dialog.player} onMute={(c, h, r) => muteChat(dialog.player, c, h, r)} onClose={() => setDialog(null)} />}
      {dialog?.type === "revive" && <ConfirmDialog title={`Revive ${dialog.player.username}?`} message={`Restores HP and clears the permadeath flag. ${dialog.player.deathCause ? `Death cause: ${dialog.player.deathCause}.` : ""}`} confirmLabel="Revive Player" onConfirm={() => revivePlayer(dialog.player)} onClose={() => setDialog(null)} />}
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

function EditPlayerDialog({ player, onSave, onClose }: { player: Player; onSave: (b: Record<string, number>) => void; onClose: () => void }) {
  const [money, setMoney] = useState(player.money);
  const [level, setLevel] = useState(player.level);
  const [xp, setXp] = useState(player.xp);
  const [atk, setAtk] = useState(player.attackPower);
  const [def, setDef] = useState(player.defensePower);
  return (
    <Modal title={`Edit ${player.username}`} onClose={onClose}>
      <div className="space-y-3">
        {([ ["Money", money, setMoney], ["Level", level, setLevel], ["XP", xp, setXp], ["ATK", atk, setAtk], ["DEF", def, setDef] ] as [string, number, (n: number) => void][]).map(([label, val, setter]) => (
          <div key={label}>
            <label className="text-xs text-slate-400">{label}</label>
            <input type="number" value={val} onChange={e => setter(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
          </div>
        ))}
        <button onClick={() => onSave({ money, level, xp, attackPower: atk, defensePower: def })} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium mt-2">Save Changes</button>
      </div>
    </Modal>
  );
}

function AddMoneyDialog({ player, onSave, onClose }: { player: Player; onSave: (a: number) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(0);
  return (
    <Modal title={`Adjust Money — ${player.username}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Current: ${player.money.toLocaleString()}</p>
        <div>
          <label className="text-xs text-slate-400">Amount (negative to deduct)</label>
          <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
        </div>
        <button onClick={() => onSave(amount)} className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg py-2 text-sm font-medium">Apply</button>
      </div>
    </Modal>
  );
}

function JailDialog({ player, onJail, onClose }: { player: Player; onJail: (h: number) => void; onClose: () => void }) {
  const [hours, setHours] = useState(1);
  return (
    <Modal title={`Jail ${player.username}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400">Hours in jail</label>
          <input type="number" min={1} max={72} value={hours} onChange={e => setHours(Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
        </div>
        <button onClick={() => onJail(hours)} className="w-full bg-orange-600 hover:bg-orange-500 text-white rounded-lg py-2 text-sm font-medium">Jail Player</button>
      </div>
    </Modal>
  );
}

function BanDialog({ player, onBan, onClose }: { player: Player; onBan: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={`Ban ${player.username}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-xs text-red-400">
          Banning prevents the player from appearing as active. They cannot be targeted or take actions.
        </div>
        <div>
          <label className="text-xs text-slate-400">Ban Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Cheating, harassment, etc." className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
        </div>
        <button onClick={() => onBan(reason || "Admin ban")} className="w-full bg-red-700 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Ban Player</button>
      </div>
    </Modal>
  );
}

function ChatMuteDialog({ player, onMute, onClose }: { player: Player; onMute: (channel: string, durationHours: number | null, reason: string) => void; onClose: () => void }) {
  const [channel, setChannel] = useState("all");
  const [durationHours, setDurationHours] = useState<number | "">(24);
  const [reason, setReason] = useState("");
  const [permanent, setPermanent] = useState(false);
  return (
    <Modal title={`Mute Chat — ${player.username}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400">Channel</label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm">
            <option value="all">All channels</option>
            <option value="global">Global</option>
            <option value="gang">Gang</option>
            <option value="city">City</option>
            <option value="private">Private</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={permanent} onChange={e => setPermanent(e.target.checked)} className="accent-purple-500" />
          Permanent mute
        </label>
        {!permanent && (
          <div>
            <label className="text-xs text-slate-400">Duration (hours)</label>
            <input type="number" min={1} value={durationHours} onChange={e => setDurationHours(e.target.value === "" ? "" : Number(e.target.value))} className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
          </div>
        )}
        <div>
          <label className="text-xs text-slate-400">Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Spam, harassment, etc." className="w-full mt-1 bg-[#0f172a] border border-slate-600 rounded px-3 py-2 text-white text-sm" />
        </div>
        <button
          onClick={() => onMute(channel, permanent ? null : (typeof durationHours === "number" && durationHours > 0 ? durationHours : 24), reason)}
          className="w-full bg-purple-700 hover:bg-purple-600 text-white rounded-lg py-2 text-sm font-medium"
        >Mute Player</button>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-slate-300 mb-4">{message}</p>
      <button onClick={onConfirm} className={`w-full ${danger ? "bg-red-700 hover:bg-red-600" : "bg-yellow-600 hover:bg-yellow-500"} text-white rounded-lg py-2 text-sm font-medium`}>{confirmLabel}</button>
    </Modal>
  );
}
