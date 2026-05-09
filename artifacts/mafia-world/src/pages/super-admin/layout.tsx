import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

interface AdminUser { id: number; username: string; }

const NAV = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/super-admin/players", label: "Players", icon: "👥" },
  { href: "/super-admin/gangs", label: "Gangs", icon: "🔫" },
  { href: "/super-admin/attacks", label: "Attacks", icon: "⚔️" },
  { href: "/super-admin/prison", label: "Prison", icon: "🔒" },
  { href: "/super-admin/crimes", label: "Crimes", icon: "💼" },
  { href: "/super-admin/cities", label: "Cities", icon: "🏙️" },
  { href: "/super-admin/blackmarket", label: "Black Market", icon: "🛒" },
  { href: "/super-admin/activity-log", label: "Activity Log", icon: "📋" },
  { href: "/super-admin/settings", label: "Settings", icon: "⚙️" },
  { href: "/super-admin/dev", label: "Dev Tools", icon: "🛠️" },
];

interface AdminLayoutProps { children: ReactNode; }

export function AdminLayout({ children }: AdminLayoutProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/super-admin/auth/me", { credentials: "include" })
      .then(async r => {
        if (r.ok) { setUser(await r.json() as AdminUser); }
        else { setLocation("/super-admin/login"); }
      })
      .catch(() => setLocation("/super-admin/login"))
      .finally(() => setLoading(false));
  }, [setLocation]);

  async function logout() {
    await fetch("/api/super-admin/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/super-admin/login");
  }

  if (loading) {
    return (
      <div style={{ fontFamily: "'Cairo', sans-serif" }} className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif" }} className="min-h-screen bg-[#0f172a] text-slate-100 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-[#1e293b] border-r border-slate-700 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="text-[#ef4444] text-2xl">⚙</span>
            <div>
              <div className="font-bold text-sm text-white">Super Admin</div>
              <div className="text-xs text-slate-400">Mafia World</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(item => {
            const active = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/20"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 text-xs text-slate-500 mb-2">Signed in as <span className="text-slate-300">{user.username}</span></div>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition-colors"
          >
            🚪 Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[70px] bg-[#1e293b] border-b border-slate-700 flex items-center px-4 gap-4 shrink-0">
          <button
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1">
            <div className="text-sm text-slate-400">
              {NAV.find(n => location.startsWith(n.href))?.label ?? "Super Admin"}
            </div>
          </div>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to Game
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
