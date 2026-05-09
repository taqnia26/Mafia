import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Users, Swords, Building2, DollarSign, Lock, RefreshCw, UserCheck,
  UserX, Package, MapPin, Crosshair, ShieldCheck, Zap, Eye, List, ShoppingBag,
  Crown, Activity, ChevronLeft, ChevronRight, Search, Trash2, PlusCircle,
} from "lucide-react";
import {
  useGetAdminStats, useGetAdminGangs,
  useUpdateAdminPlayer, useResetAdminPlayer, useDeleteAdminGang,
  useGetAdminWeapons, useUpdateAdminWeapon, useDeleteAdminWeapon,
  useGetAdminAmmo, useUpdateAdminAmmo,
  useGetAdminArmor, useUpdateAdminArmor,
  useGetAdminCities, useUpdateAdminCity,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Tab = "overview" | "players" | "gangs" | "items" | "blackmarket" | "events" | "roles" | "cities" | "audit";
type AdminRole = "reviewer" | "moderator" | "admin" | "superadmin" | null;

interface AdminPlayerExtended {
  id: number;
  username: string;
  level: number;
  xp: number;
  money: number;
  attackPower: number;
  defensePower: number;
  killCount: number;
  deathCount: number;
  isInPrison: boolean;
  prisonReleaseAt: string | null;
  isTraveling: boolean;
  isAdmin: boolean;
  adminRole: AdminRole;
  gangId: number | null;
  gangName: string | null;
  gangRank: string | null;
  cityId: number;
  cityName: string;
  createdAt: string;
}

interface AdminPlayerListResponse {
  players: AdminPlayerExtended[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_LEVELS: Record<string, number> = {
  reviewer: 1, moderator: 2, admin: 3, superadmin: 4,
};

function isAtLeast(role: AdminRole, minRole: string): boolean {
  return (ROLE_LEVELS[role ?? ""] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99);
}

function roleBadgeColor(role: AdminRole) {
  if (role === "superadmin") return "text-yellow-400 border-yellow-500 bg-yellow-900/20";
  if (role === "admin") return "text-orange-400 border-orange-500 bg-orange-900/20";
  if (role === "moderator") return "text-blue-400 border-blue-500 bg-blue-900/20";
  if (role === "reviewer") return "text-green-400 border-green-500 bg-green-900/20";
  return "text-muted-foreground border-border";
}

interface EditingItem {
  id: number;
  kind: "weapon" | "ammo" | "armor" | "city";
  field: string;
  value: string;
}

interface EditPlayerModal {
  id: number;
  username: string;
  money: number;
  level: number;
  xp: number;
  attackPower: number;
  defensePower: number;
}

interface GangEditModal {
  id: number;
  name: string;
  description: string;
  treasury: number;
  color: string;
}

function useAdminRole() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const res = await fetch(`/api/players/me`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json() as { adminRole?: AdminRole; isAdmin?: boolean };
      return data.adminRole ?? (data.isAdmin ? "admin" as AdminRole : null);
    },
  });
}

function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/overview`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        totalPlayers: number; totalGangs: number; totalPrisoners: number;
        attacksToday: number; totalMoneyInCirculation: number;
        topPlayers: Array<{ id: number; username: string; level: number; killCount: number; money: number }>;
        recentEvents: Array<{ id: number; type: string; description: string; createdAt: string }>;
      }>;
    },
  });
}

function useAdminPlayers(params: { page: number; search?: string; prisonFilter?: boolean }) {
  return useQuery({
    queryKey: ["admin-players-v2", params],
    queryFn: async () => {
      const q = new URLSearchParams({ page: String(params.page), limit: "50" });
      if (params.search) q.set("search", params.search);
      if (params.prisonFilter) q.set("prisonFilter", "true");
      const res = await fetch(`/api/admin/players?${q}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<AdminPlayerListResponse>;
    },
  });
}

function useAdminEvents(params: { page: number; type?: string; playerSearch?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ["admin-events", params],
    queryFn: async () => {
      const q = new URLSearchParams({ page: String(params.page), limit: "50" });
      if (params.type) q.set("type", params.type);
      if (params.playerSearch) q.set("playerId", params.playerSearch);
      if (params.dateFrom) q.set("dateFrom", params.dateFrom);
      if (params.dateTo) q.set("dateTo", params.dateTo);
      const res = await fetch(`/api/admin/events?${q}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        events: Array<{ id: number; playerId: number; type: string; description: string; createdAt: string; username: string | null }>;
        total: number; page: number;
      }>;
    },
  });
}

function useAdminActionsLog(page: number) {
  return useQuery({
    queryKey: ["admin-actions-log", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/actions-log?page=${page}&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        logs: Array<{ id: number; adminId: number; adminUsername: string; action: string; targetType: string; targetId: number | null; description: string; createdAt: string }>;
        total: number; page: number;
      }>;
    },
  });
}

function useAdminBlackMarket() {
  return useQuery({
    queryKey: ["admin-blackmarket"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/blackmarket`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Array<{ id: number; sellerUsername: string; itemType: string; itemName: string; quantity: number; price: number; createdAt: string }>>;
    },
  });
}

function useAdminRoles() {
  return useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/roles`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Array<{ id: number; username: string; adminRole: AdminRole; isAdmin: boolean }>>;
    },
  });
}

function useAdminGangMembers(gangId: number | null) {
  return useQuery({
    queryKey: ["admin-gang-members", gangId],
    queryFn: async () => {
      if (!gangId) return [];
      const res = await fetch(`/api/admin/gangs/${gangId}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Array<{ id: number; username: string; level: number; gangRank: string | null }>>;
    },
    enabled: !!gangId,
  });
}

function useAdminActionsMutation() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-players"] });
    void qc.invalidateQueries({ queryKey: ["admin-gangs"] });
    void qc.invalidateQueries({ queryKey: ["admin-blackmarket"] });
    void qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };
  return { invalidate };
}

export default function Admin() {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [playerPage, setPlayerPage] = useState(1);
  const [playerSearch, setPlayerSearch] = useState("");
  const [prisonFilter, setPrisonFilter] = useState(false);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [editPlayer, setEditPlayer] = useState<EditPlayerModal | null>(null);
  const [editGang, setEditGang] = useState<GangEditModal | null>(null);
  const [gangMembersFor, setGangMembersFor] = useState<number | null>(null);
  const [eventTypeFiler, setEventTypeFilter] = useState("");
  const [eventPlayerSearch, setEventPlayerSearch] = useState("");
  const [eventDateFrom, setEventDateFrom] = useState("");
  const [eventDateTo, setEventDateTo] = useState("");
  const [eventPage, setEventPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [bmForm, setBmForm] = useState({ itemType: "weapon", itemId: "", quantity: "1", price: "100" });
  const [roleSearch, setRoleSearch] = useState("");
  const [roleSearchResults, setRoleSearchResults] = useState<Array<{ id: number; username: string; adminRole: AdminRole }>>([]);
  const [prisonForm, setPrisonForm] = useState<{ playerId: number; username: string } | null>(null);
  const [prisonHours, setPrisonHours] = useState("1");

  const { data: myRole } = useAdminRole();
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useAdminOverview();
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useAdminPlayers({ page: playerPage, search: playerSearch || undefined, prisonFilter: prisonFilter || undefined });
  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs } = useGetAdminGangs();
  const { data: weapons, isLoading: weaponsLoading, refetch: refetchWeapons } = useGetAdminWeapons();
  const { data: ammo, isLoading: ammoLoading, refetch: refetchAmmo } = useGetAdminAmmo();
  const { data: armor, isLoading: armorLoading, refetch: refetchArmor } = useGetAdminArmor();
  const { data: cities, isLoading: citiesLoading, refetch: refetchCities } = useGetAdminCities();
  const { data: bmListings, isLoading: bmLoading, refetch: refetchBm } = useAdminBlackMarket();
  const { data: eventsData, isLoading: eventsLoading } = useAdminEvents({ page: eventPage, type: eventTypeFiler || undefined, playerSearch: eventPlayerSearch || undefined, dateFrom: eventDateFrom || undefined, dateTo: eventDateTo || undefined });
  const { data: auditData, isLoading: auditLoading } = useAdminActionsLog(auditPage);
  const { data: rolesData, isLoading: rolesLoading, refetch: refetchRoles } = useAdminRoles();
  const { data: gangMembers, isLoading: membersLoading } = useAdminGangMembers(gangMembersFor);
  const { invalidate } = useAdminActionsMutation();

  const { mutate: updatePlayer } = useUpdateAdminPlayer();
  const { mutate: resetPlayer } = useResetAdminPlayer();
  const { mutate: disbandGang } = useDeleteAdminGang();
  const { mutate: updateWeapon } = useUpdateAdminWeapon();
  const { mutate: deleteWeapon } = useDeleteAdminWeapon();
  const { mutate: updateAmmo } = useUpdateAdminAmmo();
  const { mutate: updateArmor } = useUpdateAdminArmor();
  const { mutate: updateCity } = useUpdateAdminCity();

  const patchPlayer = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchPlayers(); void refetchOverview(); setEditPlayer(null); toast({ title: "Player updated" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const jailPlayer = useMutation({
    mutationFn: async ({ id, hours, crime }: { id: number; hours: number; crime: string }) => {
      const res = await fetch(`/api/admin/players/${id}/prison`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hours, crime }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchPlayers(); setPrisonForm(null); toast({ title: "Player jailed" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const releasePlayer = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/players/${id}/prison`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchPlayers(); toast({ title: "Player released" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/players/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchPlayers(); void refetchOverview(); toast({ title: "Player deleted" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const patchGang = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/gangs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchGangs(); setEditGang(null); toast({ title: "Gang updated" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const kickMember = useMutation({
    mutationFn: async ({ gangId, playerId }: { gangId: number; playerId: number }) => {
      const res = await fetch(`/api/admin/gangs/${gangId}/kick/${playerId}`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["admin-gang-members"] }); void refetchGangs(); toast({ title: "Member kicked" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/blackmarket/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchBm(); toast({ title: "Listing removed" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const createListing = useMutation({
    mutationFn: async (data: typeof bmForm) => {
      const res = await fetch(`/api/admin/blackmarket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ itemType: data.itemType, itemId: parseInt(data.itemId), quantity: parseInt(data.quantity), price: parseInt(data.price) }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchBm(); setBmForm({ itemType: "weapon", itemId: "", quantity: "1", price: "100" }); toast({ title: "Listing created" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const setRole = useMutation({
    mutationFn: async ({ playerId, adminRole }: { playerId: number; adminRole: AdminRole }) => {
      const res = await fetch(`/api/admin/roles/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ adminRole }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
    },
    onSuccess: () => { void refetchRoles(); setRoleSearchResults([]); setRoleSearch(""); toast({ title: "Role updated" }); },
    onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
  });

  const handleRoleSearch = async (q: string) => {
    setRoleSearch(q);
    if (!q) { setRoleSearchResults([]); return; }
    try {
      const res = await fetch(`/api/admin/roles/search?search=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.ok) setRoleSearchResults(await res.json() as typeof roleSearchResults);
    } catch (_) {}
  };

  const startEdit = (id: number, kind: EditingItem["kind"], field: string, current: string | number) => {
    setEditing({ id, kind, field, value: String(current) });
  };

  const commitEdit = () => {
    if (!editing) return;
    const { id, kind, field, value } = editing;
    const numVal = Number(value);
    if (kind === "weapon") {
      const patch: Record<string, string | number> = {};
      if (field === "price" || field === "attackPower") patch[field] = numVal;
      else patch[field] = value;
      updateWeapon({ weaponId: id, data: patch }, {
        onSuccess: () => { toast({ title: "Weapon updated" }); void refetchWeapons(); setEditing(null); },
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    } else if (kind === "ammo") {
      const patch: Record<string, string | number> = {};
      if (field === "price" || field === "damageBonus") patch[field] = numVal;
      else patch[field] = value;
      updateAmmo({ ammoId: id, data: patch }, {
        onSuccess: () => { toast({ title: "Ammo updated" }); void refetchAmmo(); setEditing(null); },
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    } else if (kind === "armor") {
      const patch: Record<string, string | number> = {};
      if (field === "price" || field === "defenseBonus") patch[field] = numVal;
      else patch[field] = value;
      updateArmor({ armorId: id, data: patch }, {
        onSuccess: () => { toast({ title: "Armor updated" }); void refetchArmor(); setEditing(null); },
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    } else if (kind === "city") {
      const patch: Record<string, string | number> = {};
      if (field === "travelHoursBase") patch[field] = numVal;
      else patch[field] = value;
      updateCity({ cityId: id, data: patch }, {
        onSuccess: () => { toast({ title: "City updated" }); void refetchCities(); setEditing(null); },
        onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
      });
    }
  };

  if (!myRole && myRole !== undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t("admin.notAdmin")}</p>
      </div>
    );
  }

  const canModerate = isAtLeast(myRole ?? null, "moderator");
  const canAdmin = isAtLeast(myRole ?? null, "admin");
  const isSuperAdmin = isAtLeast(myRole ?? null, "superadmin");

  const tabs: { key: Tab; label: string; icon: React.ElementType; minRole?: string }[] = ([
    { key: "overview", label: t("admin.overview"), icon: Activity },
    { key: "players", label: t("admin.managePlayers"), icon: Users },
    { key: "gangs", label: t("admin.manageGangs"), icon: Building2 },
    { key: "items", label: t("admin.items"), icon: Package },
    { key: "blackmarket", label: t("admin.blackmarket"), icon: ShoppingBag, minRole: "admin" },
    { key: "events", label: t("admin.eventLog"), icon: List },
    { key: "audit", label: t("admin.auditLog"), icon: Eye, minRole: "admin" },
    { key: "roles", label: t("admin.roles"), icon: Crown, minRole: "superadmin" },
    { key: "cities", label: t("admin.cities"), icon: MapPin },
  ] as { key: Tab; label: string; icon: React.ElementType; minRole?: string }[]).filter(tb => !tb.minRole || isAtLeast(myRole ?? null, tb.minRole));

  const displayStats = overview ?? stats;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-heading font-bold uppercase tracking-wider text-primary">{t("admin.title")}</h1>
        </div>
        {myRole && (
          <Badge variant="outline" className={`${roleBadgeColor(myRole)} uppercase text-xs font-bold`}>
            {myRole}
          </Badge>
        )}
      </div>

      {/* Stats Bar */}
      {(overviewLoading || statsLoading) ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 bg-card" />)}
        </div>
      ) : displayStats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t("admin.totalPlayers"), value: displayStats.totalPlayers, icon: Users, color: "text-blue-400" },
            { label: t("admin.totalGangs"), value: displayStats.totalGangs, icon: Building2, color: "text-purple-400" },
            { label: "attacksToday" in displayStats ? t("admin.attacksToday") : t("admin.totalAttacks"), value: "attacksToday" in displayStats ? displayStats.attacksToday : (displayStats as { totalAttacks: number }).totalAttacks, icon: Swords, color: "text-red-400" },
            { label: t("admin.prisoners"), value: displayStats.totalPrisoners, icon: Lock, color: "text-orange-400" },
            { label: t("admin.economy"), value: `$${Number(displayStats.totalMoneyInCirculation).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-3 flex flex-col items-center text-center">
                <Icon className={`w-5 h-5 ${color} mb-1`} />
                <p className="text-[10px] text-muted-foreground uppercase leading-tight">{label}</p>
                <p className="font-mono text-lg font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto pb-0 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase text-muted-foreground flex items-center gap-2">
                <Crown className="w-4 h-4" /> {t("admin.topPlayers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {overview.topPlayers.map((p, i) => (
                  <div key={p.id} className="px-4 py-2 flex items-center gap-3">
                    <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                    <span className="flex-1 text-sm font-bold">{p.username}</span>
                    <span className="text-xs text-muted-foreground">Lv.{p.level}</span>
                    <span className="text-xs font-mono text-red-400">{p.killCount} kills</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" /> {t("admin.recentEvents")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {overview.recentEvents.map((e) => (
                  <div key={e.id} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{e.type}</Badge>
                      <p className="text-xs text-muted-foreground truncate">{e.description}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PLAYERS ── */}
      {tab === "players" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              className="bg-secondary border-border max-w-xs text-sm h-8"
              placeholder={t("common.search") + "..."}
              value={playerSearch}
              onChange={(e) => { setPlayerSearch(e.target.value); setPlayerPage(1); }}
            />
            <Button size="sm" variant={prisonFilter ? "default" : "outline"} className="h-8 text-xs"
              onClick={() => { setPrisonFilter(!prisonFilter); setPlayerPage(1); }}>
              <Lock className="w-3 h-3 mr-1" /> {t("admin.prisoners")}
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {playersLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-secondary" />)}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(playersData?.players ?? []).map((player: AdminPlayerExtended) => (
                    <div key={player.id} className="p-3 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[140px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm">{player.username}</span>
                          {player.adminRole && (
                            <Badge variant="outline" className={`${roleBadgeColor(player.adminRole)} text-[10px] px-1`}>
                              {player.adminRole}
                            </Badge>
                          )}
                          {player.isInPrison && <Badge variant="outline" className="text-orange-400 border-orange-500 text-[10px] px-1">Jailed</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">Lv.{player.level} · ${player.money?.toLocaleString()} · {player.cityName}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {canModerate && (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2"
                            onClick={() => setEditPlayer({ id: player.id, username: player.username, money: player.money ?? 0, level: player.level ?? 1, xp: player.xp ?? 0, attackPower: player.attackPower ?? 10, defensePower: player.defensePower ?? 10 })}>
                            {t("common.edit") || "Edit"}
                          </Button>
                        )}
                        {player.isInPrison ? (
                          canModerate && (
                            <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 border-green-700 text-green-400 hover:bg-green-900/30"
                              onClick={() => releasePlayer.mutate(player.id)}>
                              <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.release")}
                            </Button>
                          )
                        ) : canModerate && (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 border-orange-700 text-orange-400 hover:bg-orange-900/30"
                            onClick={() => { setPrisonForm({ playerId: player.id, username: player.username }); setPrisonHours("1"); }}>
                            <Lock className="w-3 h-3 mr-1" /> {t("admin.jail")}
                          </Button>
                        )}
                        {canAdmin && (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 border-blue-700 text-blue-400 hover:bg-blue-900/30"
                            onClick={() => {
                              if (!confirm(`Reset stats for ${player.username}?`)) return;
                              resetPlayer({ playerId: player.id }, {
                                onSuccess: () => { toast({ title: `${player.username}'s stats reset` }); void refetchPlayers(); },
                                onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
                              });
                            }}>
                            <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.resetStats")}
                          </Button>
                        )}
                        {isSuperAdmin && (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 border-red-800 text-red-400 hover:bg-red-900/30"
                            onClick={() => { if (!confirm(`DELETE player ${player.username}? This is irreversible!`)) return; deletePlayer.mutate(player.id); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {playersData && playersData.total > 50 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{playersData.total} total</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={playerPage <= 1} onClick={() => setPlayerPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 flex items-center">Page {playerPage}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={playerPage * 50 >= playersData.total} onClick={() => setPlayerPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GANGS ── */}
      {tab === "gangs" && (
        <div className="space-y-3">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {gangsLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(gangs ?? []).map((gang) => (
                    <div key={gang.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: (gang as { color?: string }).color ?? "#8B0000" }} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{gang.name}</span>
                            <span className="text-xs text-muted-foreground">Boss: {(gang as { bossName?: string }).bossName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{gang.memberCount} members · ${gang.treasury.toLocaleString()} treasury</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                            onClick={() => setEditGang({ id: gang.id, name: gang.name, description: (gang as unknown as { description?: string }).description ?? "", treasury: gang.treasury, color: (gang as unknown as { color?: string }).color ?? "#8B0000" })}>
                            {t("common.edit") || "Edit"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                            onClick={() => setGangMembersFor(gangMembersFor === gang.id ? null : gang.id)}>
                            <Users className="w-3 h-3 mr-1" /> Members
                          </Button>
                          {canAdmin && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-red-800 text-red-400 hover:bg-red-900/30"
                              onClick={() => { if (!confirm(`Disband "${gang.name}"?`)) return; disbandGang({ gangId: gang.id }, { onSuccess: () => { void refetchGangs(); void refetchPlayers(); toast({ title: `Gang "${gang.name}" disbanded` }); }, onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }) }); }}>
                              {t("admin.disband")}
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Gang Members Accordion */}
                      {gangMembersFor === gang.id && (
                        <div className="mt-2 ml-6 border-l border-border/50 pl-3 space-y-1">
                          {membersLoading ? <Skeleton className="h-8 w-full bg-secondary" /> : (gangMembers ?? []).map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs">
                              <span className="text-foreground">{m.username}</span>
                              <span className="text-muted-foreground">Lv.{m.level}</span>
                              <span className="text-muted-foreground">{m.gangRank}</span>
                              {canAdmin && (
                                <Button size="sm" variant="ghost" className="h-5 text-[10px] text-red-400 px-1 ml-auto"
                                  onClick={() => { if (!confirm(`Kick ${m.username}?`)) return; kickMember.mutate({ gangId: gang.id, playerId: m.id }); }}>
                                  Kick
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ITEMS ── */}
      {tab === "items" && (
        <div className="space-y-4">
          {editing && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
              <div className="bg-card border border-border rounded-lg p-5 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h2 className="font-heading uppercase text-primary text-sm">{t("admin.updateItem")}</h2>
                <Input className="bg-secondary border-border" value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                  autoFocus />
                <div className="flex gap-2">
                  <Button className="flex-1 h-8 text-sm" onClick={commitEdit}>Save</Button>
                  <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading uppercase text-sm flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400" /> {t("admin.weapons")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {weaponsLoading ? <Skeleton className="h-24 m-3 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {(weapons ?? []).map((w) => (
                    <div key={w.id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[100px]">
                        <span className="text-sm font-bold">{w.name}</span>
                        <p className="text-[10px] text-muted-foreground">{w.type}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-mono text-muted-foreground items-center">
                        {canAdmin ? (
                          <>
                            <button className="hover:text-primary" onClick={() => startEdit(w.id, "weapon", "attackPower", w.attackPower)}>
                              ATK: <span className="text-foreground">{w.attackPower}</span>
                            </button>
                            <button className="hover:text-primary" onClick={() => startEdit(w.id, "weapon", "price", w.price)}>
                              ${w.price.toLocaleString()}
                            </button>
                            {isSuperAdmin && (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400 px-1"
                                onClick={() => { if (confirm(`Delete ${w.name}?`)) deleteWeapon({ weaponId: w.id }, { onSuccess: () => { void refetchWeapons(); toast({ title: "Deleted" }); } }); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <span>ATK: {w.attackPower} · ${w.price.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading uppercase text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> {t("admin.ammo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ammoLoading ? <Skeleton className="h-24 m-3 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {(ammo ?? []).map((a) => (
                    <div key={a.id} className="px-3 py-2 flex items-center gap-2">
                      <div className="flex-1"><span className="text-sm font-bold">{a.name}</span><p className="text-[10px] text-muted-foreground">{a.type}</p></div>
                      <div className="flex gap-2 text-xs font-mono text-muted-foreground">
                        {canAdmin ? (
                          <>
                            <button className="hover:text-primary" onClick={() => startEdit(a.id, "ammo", "damageBonus", a.damageBonus)}>
                              DMG: <span className="text-foreground">+{a.damageBonus}</span>
                            </button>
                            <button className="hover:text-primary" onClick={() => startEdit(a.id, "ammo", "price", a.price)}>
                              ${a.price.toLocaleString()}
                            </button>
                          </>
                        ) : <span>DMG: +{a.damageBonus} · ${a.price.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading uppercase text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> {t("admin.armor")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {armorLoading ? <Skeleton className="h-24 m-3 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {(armor ?? []).map((a) => (
                    <div key={a.id} className="px-3 py-2 flex items-center gap-2">
                      <div className="flex-1"><span className="text-sm font-bold">{a.name}</span><p className="text-[10px] text-muted-foreground">{a.type}</p></div>
                      <div className="flex gap-2 text-xs font-mono text-muted-foreground">
                        {canAdmin ? (
                          <>
                            <button className="hover:text-primary" onClick={() => startEdit(a.id, "armor", "defenseBonus", a.defenseBonus)}>
                              DEF: <span className="text-foreground">{a.defenseBonus}</span>
                            </button>
                            <button className="hover:text-primary" onClick={() => startEdit(a.id, "armor", "price", a.price)}>
                              ${a.price.toLocaleString()}
                            </button>
                          </>
                        ) : <span>DEF: {a.defenseBonus} · ${a.price.toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── BLACK MARKET ── */}
      {tab === "blackmarket" && canAdmin && (
        <div className="space-y-4">
          {/* Add Listing Form */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-green-400" /> {t("admin.addListing")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select className="bg-secondary border border-border rounded px-2 py-1 text-sm"
                  value={bmForm.itemType} onChange={(e) => setBmForm({ ...bmForm, itemType: e.target.value })}>
                  <option value="weapon">Weapon</option>
                  <option value="ammo">Ammo</option>
                  <option value="armor">Armor</option>
                </select>
                <Input className="bg-secondary border-border text-sm h-8" placeholder="Item ID" value={bmForm.itemId}
                  onChange={(e) => setBmForm({ ...bmForm, itemId: e.target.value })} />
                <Input className="bg-secondary border-border text-sm h-8" placeholder="Qty" type="number" min="1" value={bmForm.quantity}
                  onChange={(e) => setBmForm({ ...bmForm, quantity: e.target.value })} />
                <Input className="bg-secondary border-border text-sm h-8" placeholder="Price $" type="number" min="1" value={bmForm.price}
                  onChange={(e) => setBmForm({ ...bmForm, price: e.target.value })} />
              </div>
              <Button size="sm" className="mt-2 h-8 text-xs" onClick={() => createListing.mutate(bmForm)} disabled={!bmForm.itemId}>
                <PlusCircle className="w-3 h-3 mr-1" /> Create Listing
              </Button>
            </CardContent>
          </Card>

          {/* Listings */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> {t("admin.blackmarket")} ({bmListings?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bmLoading ? <Skeleton className="h-32 m-3 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {(bmListings ?? []).map((l) => (
                    <div key={l.id} className="px-3 py-2 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1">{l.itemType}</Badge>
                          <span className="text-sm font-bold">{l.itemName}</span>
                          <span className="text-xs text-muted-foreground">x{l.quantity}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">${l.price.toLocaleString()} · Seller: {l.sellerUsername}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 text-red-400 px-2 text-xs"
                        onClick={() => { if (confirm("Remove this listing?")) deleteListing.mutate(l.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {!bmListings?.length && <p className="text-center text-muted-foreground text-sm py-6">No listings</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── EVENTS LOG ── */}
      {tab === "events" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <select className="bg-secondary border border-border rounded px-2 py-1 text-xs"
              value={eventTypeFiler} onChange={(e) => { setEventTypeFilter(e.target.value); setEventPage(1); }}>
              <option value="">All Types</option>
              <option value="attack_sent">attack_sent</option>
              <option value="attack_received">attack_received</option>
              <option value="crime_success">crime_success</option>
              <option value="crime_failed">crime_failed</option>
              <option value="jailed">jailed</option>
              <option value="released">released</option>
              <option value="joined_gang">joined_gang</option>
              <option value="left_gang">left_gang</option>
              <option value="black_market_listed">black_market_listed</option>
              <option value="black_market_purchase">black_market_purchase</option>
              <option value="traveled">traveled</option>
            </select>
            <Input
              className="bg-secondary border-border max-w-[160px] text-xs h-7"
              placeholder="Player ID or name..."
              value={eventPlayerSearch}
              onChange={(e) => { setEventPlayerSearch(e.target.value); setEventPage(1); }}
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>From</span>
              <input type="date" className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs"
                value={eventDateFrom} onChange={(e) => { setEventDateFrom(e.target.value); setEventPage(1); }} />
              <span>To</span>
              <input type="date" className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs"
                value={eventDateTo} onChange={(e) => { setEventDateTo(e.target.value); setEventPage(1); }} />
            </div>
            {(eventTypeFiler || eventPlayerSearch || eventDateFrom || eventDateTo) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                onClick={() => { setEventTypeFilter(""); setEventPlayerSearch(""); setEventDateFrom(""); setEventDateTo(""); setEventPage(1); }}>
                Clear
              </Button>
            )}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {eventsLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 bg-secondary" />)}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(eventsData?.events ?? []).map((e) => (
                    <div key={e.id} className="px-3 py-2 flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 mt-0.5">{e.type}</Badge>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary">{e.username ?? `#${e.playerId}`}</span>
                        <p className="text-[11px] text-muted-foreground truncate">{e.description}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 shrink-0">{new Date(e.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {!eventsData?.events.length && <p className="text-center text-muted-foreground text-sm py-6">No events</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {eventsData && eventsData.total > 50 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{eventsData.total} total</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={eventPage <= 1} onClick={() => setEventPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 flex items-center">Page {eventPage}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={eventPage * 50 >= eventsData.total} onClick={() => setEventPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === "audit" && canAdmin && (
        <div className="space-y-3">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                <Eye className="w-4 h-4" /> {t("admin.auditLog")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 bg-secondary" />)}</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(auditData?.logs ?? []).map((log) => (
                    <div key={log.id} className="px-3 py-2 flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 mt-0.5 border-orange-700 text-orange-400">{log.action}</Badge>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary">{log.adminUsername}</span>
                        <span className="text-[11px] text-muted-foreground"> → {log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</span>
                        <p className="text-[11px] text-muted-foreground/80 truncate">{log.description}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 shrink-0">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  {!auditData?.logs.length && <p className="text-center text-muted-foreground text-sm py-6">No admin actions logged</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {auditData && auditData.total > 50 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{auditData.total} total</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 flex items-center">Page {auditPage}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={auditPage * 50 >= auditData.total} onClick={() => setAuditPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ROLES ── */}
      {tab === "roles" && isSuperAdmin && (
        <div className="space-y-4">
          {/* Search & Assign */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                <Search className="w-4 h-4" /> {t("admin.assignRole")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input className="bg-secondary border-border text-sm h-8" placeholder={t("common.search") + " player..."}
                value={roleSearch} onChange={(e) => void handleRoleSearch(e.target.value)} />
              {roleSearchResults.length > 0 && (
                <div className="border border-border rounded divide-y divide-border/50">
                  {roleSearchResults.map((p) => (
                    <div key={p.id} className="px-3 py-2 flex items-center gap-2">
                      <span className="flex-1 text-sm">{p.username}</span>
                      {p.adminRole && <Badge variant="outline" className={`${roleBadgeColor(p.adminRole)} text-[10px]`}>{p.adminRole}</Badge>}
                      <div className="flex gap-1">
                        {(["reviewer", "moderator", "admin", "superadmin"] as const).map((r) => (
                          <Button key={r} size="sm" variant={p.adminRole === r ? "default" : "outline"} className="h-6 text-[10px] px-2"
                            onClick={() => { if (confirm(`Set ${p.username} as ${r}?`)) setRole.mutate({ playerId: p.id, adminRole: r }); }}>
                            {r}
                          </Button>
                        ))}
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-800 text-red-400"
                          onClick={() => { if (confirm(`Remove ${p.username}'s admin role?`)) setRole.mutate({ playerId: p.id, adminRole: null }); }}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Admins */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading uppercase flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-400" /> {t("admin.currentAdmins")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rolesLoading ? <Skeleton className="h-24 m-3 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {(rolesData ?? []).map((a) => (
                    <div key={a.id} className="px-3 py-2 flex items-center gap-3">
                      <span className="flex-1 text-sm font-bold">{a.username}</span>
                      <Badge variant="outline" className={`${roleBadgeColor(a.adminRole)} uppercase text-[10px]`}>
                        {a.adminRole ?? "legacy admin"}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400 px-2"
                        onClick={() => { if (confirm(`Remove ${a.username}'s admin role?`)) setRole.mutate({ playerId: a.id, adminRole: null }); }}>
                        Remove
                      </Button>
                    </div>
                  ))}
                  {!rolesData?.length && <p className="text-center text-muted-foreground text-sm py-6">No admins assigned</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CITIES ── */}
      {tab === "cities" && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading uppercase text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-400" /> {t("admin.cities")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {citiesLoading ? <Skeleton className="h-32 m-3 bg-secondary" /> : (
              <div className="divide-y divide-border/50">
                {(cities ?? []).map((c) => (
                  <div key={c.id} className="px-3 py-2 flex items-center gap-3">
                    <div className="flex-1">
                      <span className="text-sm font-bold">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">/ {c.nameAr}</span>
                    </div>
                    {canAdmin ? (
                      <button className="text-xs font-mono text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border/50"
                        onClick={() => startEdit(c.id, "city", "travelHoursBase", c.travelHoursBase)}>
                        {c.travelHoursBase}h
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground">{c.travelHoursBase}h</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {editing?.kind === "city" && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
                <div className="bg-card border border-border rounded-lg p-5 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <h2 className="font-heading uppercase text-primary text-sm">{t("admin.travelHours")}</h2>
                  <Input type="number" min={1} max={24} className="bg-secondary border-border" value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                    autoFocus />
                  <div className="flex gap-2">
                    <Button className="flex-1 h-8" onClick={commitEdit}>Save</Button>
                    <Button variant="outline" className="flex-1 h-8" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── EDIT PLAYER MODAL ── */}
      {editPlayer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setEditPlayer(null)}>
          <div className="bg-card border border-border rounded-lg p-5 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading uppercase text-primary text-sm">{t("admin.editPlayer")}: {editPlayer.username}</h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "money", label: "Money", val: editPlayer.money },
                { key: "level", label: "Level", val: editPlayer.level },
                { key: "xp", label: "XP", val: editPlayer.xp },
                { key: "attackPower", label: "ATK Power", val: editPlayer.attackPower },
                { key: "defensePower", label: "DEF Power", val: editPlayer.defensePower },
              ] as const).map(({ key, label, val }) => (
                <div key={key}>
                  <label className="text-[10px] text-muted-foreground uppercase">{label}</label>
                  <Input className="bg-secondary border-border text-sm h-7 mt-0.5" type="number" min={0}
                    value={(editPlayer as unknown as Record<string, number>)[key]}
                    onChange={(e) => setEditPlayer({ ...editPlayer, [key]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-8 text-sm" onClick={() => patchPlayer.mutate({ id: editPlayer.id, data: { money: editPlayer.money, level: editPlayer.level, xp: editPlayer.xp, attackPower: editPlayer.attackPower, defensePower: editPlayer.defensePower } })}>
                {patchPlayer.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setEditPlayer(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── JAIL PLAYER MODAL ── */}
      {prisonForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setPrisonForm(null)}>
          <div className="bg-card border border-border rounded-lg p-5 w-72 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading uppercase text-primary text-sm">{t("admin.jail")}: {prisonForm.username}</h2>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Hours</label>
              <Input className="bg-secondary border-border text-sm h-7 mt-0.5" type="number" min="1" max="720"
                value={prisonHours} onChange={(e) => setPrisonHours(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 h-8 text-sm" onClick={() => jailPlayer.mutate({ id: prisonForm.playerId, hours: parseInt(prisonHours), crime: "Admin action" })}>
                {jailPlayer.isPending ? "Jailing..." : "Jail"}
              </Button>
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setPrisonForm(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT GANG MODAL ── */}
      {editGang && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setEditGang(null)}>
          <div className="bg-card border border-border rounded-lg p-5 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading uppercase text-primary text-sm">{t("admin.editGang")}</h2>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Name</label>
              <Input className="bg-secondary border-border text-sm h-7 mt-0.5" value={editGang.name}
                onChange={(e) => setEditGang({ ...editGang, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Description</label>
              <Input className="bg-secondary border-border text-sm h-7 mt-0.5" value={editGang.description}
                onChange={(e) => setEditGang({ ...editGang, description: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Treasury</label>
              <Input className="bg-secondary border-border text-sm h-7 mt-0.5" type="number" min="0" value={editGang.treasury}
                onChange={(e) => setEditGang({ ...editGang, treasury: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Color</label>
              <div className="flex gap-2 mt-0.5">
                <input type="color" value={editGang.color} className="h-7 w-12 rounded cursor-pointer bg-transparent border-0"
                  onChange={(e) => setEditGang({ ...editGang, color: e.target.value })} />
                <span className="text-xs text-muted-foreground self-center">{editGang.color}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 h-8 text-sm" onClick={() => patchGang.mutate({ id: editGang.id, data: editGang as unknown as Record<string, unknown> })}>
                {patchGang.isPending ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" className="flex-1 h-8 text-sm" onClick={() => setEditGang(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
