import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "./layout";

interface Listing {
  id: number; item_type: string; item_name: string; quantity: number;
  price: number; seller_name: string; created_at: string;
}

export default function SuperAdminBlackMarket() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/super-admin/blackmarket", { credentials: "include" });
    if (r.ok) setListings(await r.json() as Listing[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeListing(id: number) {
    await fetch(`/api/super-admin/blackmarket/${id}`, { method: "DELETE", credentials: "include" });
    setMsg("Listing removed");
    load();
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Black Market <span className="text-slate-400 text-base font-normal">({listings.length} listings)</span></h1>
          {msg && <span className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">{msg}</span>}
        </div>

        <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-3 py-3">Type</th>
                <th className="text-right px-3 py-3">Qty</th>
                <th className="text-right px-3 py-3">Price</th>
                <th className="text-left px-3 py-3">Seller</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : listings.map(l => (
                <tr key={l.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="px-4 py-3 font-medium text-white">{l.item_name}</td>
                  <td className="px-3 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{l.item_type}</span></td>
                  <td className="px-3 py-3 text-right text-slate-300">{l.quantity}</td>
                  <td className="px-3 py-3 text-right text-slate-300">${l.price.toLocaleString()}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs">{l.seller_name}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeListing(l.id)} className="text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 px-2 py-1 rounded">Remove</button>
                  </td>
                </tr>
              ))}
              {!loading && listings.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No listings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
