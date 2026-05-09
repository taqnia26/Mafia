import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useI18n } from "@/lib/i18n";
import {
  LayoutDashboard,
  User,
  Users,
  Shield,
  Crosshair,
  Swords,
  Map,
  Settings,
  LogOut,
  ShoppingBag,
  Briefcase,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";


interface LayoutProps {
  children: ReactNode;
}

function useIsAdmin() {
  return useQuery({
    queryKey: ["layout-admin-check"],
    queryFn: async () => {
      const res = await fetch(`/api/players/me`, { credentials: "include" });
      if (!res.ok) return false;
      const data = await res.json() as { isAdmin?: boolean; adminRole?: string };
      return !!(data.isAdmin || data.adminRole);
    },
    staleTime: 60000,
  });
}

export function Layout({ children }: LayoutProps) {
  const { t, dir } = useI18n();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { data: isAdmin } = useIsAdmin();

  const navItems = [
    { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
    { href: "/profile", label: "nav.profile", icon: User },
    { href: "/players", label: "nav.players", icon: Users },
    { href: "/gangs", label: "nav.gangs", icon: Shield },
    { href: "/weapons", label: "nav.weapons", icon: Crosshair },
    { href: "/armor", label: "nav.armor", icon: Shield },
    { href: "/bodyguards", label: "nav.bodyguards", icon: Users },
    { href: "/attack", label: "nav.attack", icon: Swords },
    { href: "/blackmarket", label: "nav.blackmarket", icon: ShoppingBag },
    { href: "/crimes", label: "nav.crimes", icon: Briefcase },
    { href: "/prison", label: "nav.prison", icon: Lock },
    { href: "/cities", label: "nav.cities", icon: Map },
    { href: "/settings", label: "nav.settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border shrink-0 flex flex-col">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
            <span className="font-heading font-bold text-xl text-primary tracking-widest uppercase">
              {t("app.title")}
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{t(item.label)}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors border border-primary/20 mt-2 ${
                location === "/admin"
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-primary/70 hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span>{t("nav.admin")}</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => signOut()}
          >
            <LogOut className="w-5 h-5 mr-2" />
            {t("nav.logout")}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
