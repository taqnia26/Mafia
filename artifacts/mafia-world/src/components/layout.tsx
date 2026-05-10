import { ReactNode, useState } from "react";
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
  Award,
  Building2,
  Landmark,
  Home as HomeIcon,
  Spade,
  Crosshair as CrosshairCalc,
  MessageCircle,
  Mail,
  Menu,
  DollarSign,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";


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

function usePlayerRank() {
  return useQuery({
    queryKey: ["layout-player-rank"],
    queryFn: async () => {
      const res = await fetch(`/api/players/me`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json() as { currentRank?: number; rankNameEn?: string; rankNameAr?: string; rankColor?: string };
      return data;
    },
    staleTime: 30000,
  });
}

interface SidebarBodyProps {
  onNavigate?: () => void;
}

function SidebarBody({ onNavigate }: SidebarBodyProps) {
  const { t, language } = useI18n();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { data: isAdmin } = useIsAdmin();
  const { data: rankInfo } = usePlayerRank();

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
    { href: "/properties", label: "nav.properties", icon: Building2 },
    { href: "/bank", label: "nav.bank", icon: Landmark },
    { href: "/safe-house", label: "nav.safeHouse", icon: HomeIcon },
    { href: "/blackjack", label: "nav.blackjack", icon: Spade },
    { href: "/kill-calculator", label: "nav.killCalc", icon: CrosshairCalc },
    { href: "/chat", label: "nav.chat", icon: MessageCircle },
    { href: "/inbox", label: "nav.inbox", icon: Mail },
    { href: "/ranks", label: "nav.ranks", icon: Award },
    { href: "/settings", label: "nav.settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="hidden md:block p-6">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="Logo" className="w-8 h-8" />
            <span className="font-heading font-bold text-xl text-primary tracking-widest uppercase">
              {t("app.title")}
            </span>
          </Link>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{t(item.label)}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors border border-primary/20 mt-2 ${
              location === "/admin"
                ? "bg-primary/20 text-primary font-medium"
                : "text-primary/70 hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="truncate">{t("nav.admin")}</span>
          </Link>
        )}
      </nav>

      {rankInfo?.rankNameEn && (
        <Link href="/ranks" onClick={onNavigate}>
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-secondary/40 border border-border/50 hover:bg-secondary/70 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 shrink-0" style={{ color: rankInfo.rankColor ?? "#6b7280" }} />
              <span
                className="text-xs font-heading font-bold uppercase tracking-wide truncate"
                style={{ color: rankInfo.rankColor ?? "#6b7280" }}
              >
                {language === "ar" ? (rankInfo.rankNameAr ?? rankInfo.rankNameEn) : rankInfo.rankNameEn}
              </span>
              <Badge
                variant="outline"
                className="text-xs shrink-0 ml-auto"
                style={{ borderColor: rankInfo.rankColor ?? "#6b7280", color: rankInfo.rankColor ?? "#6b7280" }}
              >
                #{rankInfo.currentRank}
              </Badge>
            </div>
          </div>
        </Link>
      )}

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={() => { onNavigate?.(); signOut(); }}
        >
          <LogOut className="w-5 h-5 mr-2" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const { t, dir, language } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: profileForTopbar } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), staleTime: 30000 } });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-card border-b border-border">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side={dir === "rtl" ? "right" : "left"}
            className="p-0 w-[85vw] max-w-[20rem] flex flex-col bg-card"
          >
            <SheetHeader className="p-4 border-b border-border text-start">
              <SheetTitle className="flex items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
                <span className="font-heading font-bold text-base text-primary tracking-widest uppercase">
                  {t("app.title")}
                </span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <SidebarBody onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 min-w-0">
          <img src="/logo.svg" alt="Logo" className="w-6 h-6 shrink-0" />
          <span className="font-heading font-bold text-sm text-primary tracking-widest uppercase truncate">
            {t("app.title")}
          </span>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          {profileForTopbar && (
            <>
              <span className="flex items-center gap-1 text-xs font-mono text-green-500 bg-green-500/10 px-1.5 py-1 rounded" data-testid="topbar-money">
                <DollarSign className="w-3 h-3" />
                <span className="tabular-nums">{Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(profileForTopbar.money)}</span>
              </span>
              <span className="flex items-center gap-1 text-xs font-mono text-primary bg-primary/10 px-1.5 py-1 rounded" data-testid="topbar-level">
                <Star className="w-3 h-3" />
                <span className="tabular-nums">{profileForTopbar.level}</span>
              </span>
            </>
          )}
          <NotificationBell />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 bg-card md:border-r border-border shrink-0 flex-col">
        <SidebarBody />
      </aside>

      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 min-w-0">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
