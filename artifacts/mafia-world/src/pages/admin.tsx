import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Swords, Building2, DollarSign, Lock, RefreshCw, UserCheck, UserX, Package, MapPin, Crosshair, ShieldCheck, Zap } from "lucide-react";
import {
  useGetAdminStats, useGetAdminPlayers, useGetAdminGangs,
  useUpdateAdminPlayer, useResetAdminPlayer, useDeleteAdminGang,
  useGetAdminWeapons, useUpdateAdminWeapon, useDeleteAdminWeapon,
  useGetAdminAmmo, useUpdateAdminAmmo,
  useGetAdminArmor, useUpdateAdminArmor,
  useGetAdminCities, useUpdateAdminCity,
} from "@workspace/api-client-react";

type Tab = "players" | "gangs" | "items" | "cities";

interface EditingItem {
  id: number;
  kind: "weapon" | "ammo" | "armor" | "city";
  field: string;
  value: string;
}

export default function Admin() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [playerPage] = useState(1);
  const [tab, setTab] = useState<Tab>("players");
  const [editing, setEditing] = useState<EditingItem | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: playersData, isLoading: playersLoading, refetch: refetchPlayers } = useGetAdminPlayers({ page: playerPage, limit: 50 });
  const { data: gangs, isLoading: gangsLoading, refetch: refetchGangs } = useGetAdminGangs();
  const { data: weapons, isLoading: weaponsLoading, refetch: refetchWeapons } = useGetAdminWeapons();
  const { data: ammo, isLoading: ammoLoading, refetch: refetchAmmo } = useGetAdminAmmo();
  const { data: armor, isLoading: armorLoading, refetch: refetchArmor } = useGetAdminArmor();
  const { data: cities, isLoading: citiesLoading, refetch: refetchCities } = useGetAdminCities();

  const { mutate: updatePlayer } = useUpdateAdminPlayer();
  const { mutate: resetPlayer } = useResetAdminPlayer();
  const { mutate: disbandGang } = useDeleteAdminGang();
  const { mutate: updateWeapon } = useUpdateAdminWeapon();
  const { mutate: deleteWeapon } = useDeleteAdminWeapon();
  const { mutate: updateAmmo } = useUpdateAdminAmmo();
  const { mutate: updateArmor } = useUpdateAdminArmor();
  const { mutate: updateCity } = useUpdateAdminCity();

  const handleRelease = (playerId: number) => {
    updatePlayer({ playerId, data: { isInPrison: false } }, {
      onSuccess: () => { toast({ title: "Player released from prison" }); void refetchPlayers(); },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleReset = (playerId: number, username: string) => {
    if (!confirm(`Reset stats for ${username}?`)) return;
    resetPlayer({ playerId }, {
      onSuccess: () => { toast({ title: `${username}'s stats reset` }); void refetchPlayers(); },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleGrantAdmin = (playerId: number, isAdmin: boolean) => {
    updatePlayer({ playerId, data: { isAdmin } }, {
      onSuccess: () => { toast({ title: isAdmin ? "Admin granted" : "Admin revoked" }); void refetchPlayers(); },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
  };

  const handleDisband = (gangId: number, name: string) => {
    if (!confirm(`Disband gang "${name}"?`)) return;
    disbandGang({ gangId }, {
      onSuccess: () => { toast({ title: `Gang "${name}" disbanded` }); void refetchGangs(); void refetchPlayers(); },
      onError: (e) => toast({ title: "Error", description: String(e), variant: "destructive" }),
    });
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

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "players", label: t("admin.managePlayers"), icon: Users },
    { key: "gangs", label: t("admin.manageGangs"), icon: Building2 },
    { key: "items", label: t("admin.items"), icon: Package },
    { key: "cities", label: t("admin.cities"), icon: MapPin },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider text-primary">{t("admin.title")}</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: t("admin.totalPlayers"), value: stats.totalPlayers, icon: Users, color: "text-blue-500" },
            { label: t("admin.totalGangs"), value: stats.totalGangs, icon: Building2, color: "text-purple-500" },
            { label: t("admin.totalAttacks"), value: stats.totalAttacks, icon: Swords, color: "text-red-500" },
            { label: t("admin.prisoners"), value: stats.totalPrisoners, icon: Lock, color: "text-orange-500" },
            { label: t("admin.economy"), value: `$${stats.totalMoneyInCirculation.toLocaleString()}`, icon: DollarSign, color: "text-green-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Icon className={`w-6 h-6 ${color} mb-2`} />
                <p className="text-xs text-muted-foreground uppercase">{label}</p>
                <p className="font-mono text-xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-border/50 pb-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "players" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5" /> {t("admin.managePlayers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {playersLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {playersData?.players.map((player) => (
                  <div key={player.id} className="p-3 flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{player.username}</span>
                        {player.isAdmin && <Badge variant="outline" className="text-yellow-500 border-yellow-500 text-xs">Admin</Badge>}
                        {player.isInPrison && <Badge variant="outline" className="text-orange-500 border-orange-500 text-xs">Jailed</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Lv.{player.level} · ${player.money.toLocaleString()} · {player.cityName}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {player.isInPrison && (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-green-700 text-green-500 hover:bg-green-900" onClick={() => handleRelease(player.id)}>
                          <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.release")}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs border-blue-700 text-blue-400 hover:bg-blue-900" onClick={() => handleReset(player.id, player.username)}>
                        <RefreshCw className="w-3 h-3 mr-1" /> {t("admin.resetStats")}
                      </Button>
                      {player.isAdmin ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:bg-red-900" onClick={() => handleGrantAdmin(player.id, false)}>
                          <UserX className="w-3 h-3 mr-1" /> {t("admin.revokeAdmin")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs border-yellow-700 text-yellow-500 hover:bg-yellow-900" onClick={() => handleGrantAdmin(player.id, true)}>
                          <UserCheck className="w-3 h-3 mr-1" /> {t("admin.grantAdmin")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "gangs" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {t("admin.manageGangs")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {gangsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {gangs?.map((gang) => (
                  <div key={gang.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <span className="font-bold text-foreground">{gang.name}</span>
                      <p className="text-xs text-muted-foreground">{gang.memberCount} members · ${gang.treasury.toLocaleString()} treasury</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-red-700 text-red-400 hover:bg-red-900" onClick={() => handleDisband(gang.id, gang.name)}>
                      {t("admin.disband")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "items" && (
        <div className="space-y-4">
          {editing && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
              <div className="bg-card border border-border rounded-lg p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h2 className="font-heading uppercase text-primary">{t("admin.updateItem")}</h2>
                <Input
                  className="bg-secondary border-border"
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={commitEdit}>Save</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            </div>
          )}

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-red-500" /> {t("admin.weapons")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {weaponsLoading ? <Skeleton className="h-32 m-4 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {weapons?.map((w) => (
                    <div key={w.id} className="p-3 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <span className="font-bold text-sm">{w.name}</span>
                        <p className="text-xs text-muted-foreground font-mono">{w.type} · ATK {w.attackPower}</p>
                      </div>
                      <div className="flex gap-2 items-center text-xs font-mono text-muted-foreground">
                        <button className="hover:text-primary" onClick={() => startEdit(w.id, "weapon", "attackPower", w.attackPower)}>
                          ATK: <span className="text-foreground">{w.attackPower}</span>
                        </button>
                        <button className="hover:text-primary" onClick={() => startEdit(w.id, "weapon", "price", w.price)}>
                          ${w.price.toLocaleString()}
                        </button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs text-red-500 hover:text-red-400"
                          onClick={() => { if (confirm(`Delete ${w.name}?`)) deleteWeapon({ weaponId: w.id }, { onSuccess: () => { void refetchWeapons(); toast({ title: "Deleted" }); } }); }}>
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" /> {t("admin.ammo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ammoLoading ? <Skeleton className="h-32 m-4 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {ammo?.map((a) => (
                    <div key={a.id} className="p-3 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <span className="font-bold text-sm">{a.name}</span>
                        <p className="text-xs text-muted-foreground font-mono">{a.type}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-mono text-muted-foreground">
                        <button className="hover:text-primary" onClick={() => startEdit(a.id, "ammo", "damageBonus", a.damageBonus)}>
                          DMG: <span className="text-foreground">+{a.damageBonus}</span>
                        </button>
                        <button className="hover:text-primary" onClick={() => startEdit(a.id, "ammo", "price", a.price)}>
                          ${a.price.toLocaleString()}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-500" /> {t("admin.armor")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {armorLoading ? <Skeleton className="h-32 m-4 bg-secondary" /> : (
                <div className="divide-y divide-border/50">
                  {armor?.map((a) => (
                    <div key={a.id} className="p-3 flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-[120px]">
                        <span className="font-bold text-sm">{a.name}</span>
                        <p className="text-xs text-muted-foreground font-mono">{a.type} · DEF {a.defenseBonus}</p>
                      </div>
                      <div className="flex gap-2 text-xs font-mono text-muted-foreground">
                        <button className="hover:text-primary" onClick={() => startEdit(a.id, "armor", "defenseBonus", a.defenseBonus)}>
                          DEF: <span className="text-foreground">{a.defenseBonus}</span>
                        </button>
                        <button className="hover:text-primary" onClick={() => startEdit(a.id, "armor", "price", a.price)}>
                          ${a.price.toLocaleString()}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "cities" && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-500" /> {t("admin.cities")} — {t("admin.travelHours")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {citiesLoading ? <Skeleton className="h-32 m-4 bg-secondary" /> : (
              <div className="divide-y divide-border/50">
                {cities?.map((c) => (
                  <div key={c.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <span className="font-bold text-sm">{c.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">/ {c.nameAr}</span>
                      <p className="text-xs text-muted-foreground">{c.country}</p>
                    </div>
                    <button
                      className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded border border-border/50"
                      onClick={() => {
                        if (!editing) {
                          setEditing({ id: c.id, kind: "city", field: "travelHoursBase", value: String(c.travelHoursBase) });
                        }
                      }}
                    >
                      {c.travelHoursBase}h
                    </button>
                  </div>
                ))}
              </div>
            )}
            {editing?.kind === "city" && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
                <div className="bg-card border border-border rounded-lg p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <h2 className="font-heading uppercase text-primary">{t("admin.travelHours")}</h2>
                  <Input
                    type="number"
                    min={1} max={24}
                    className="bg-secondary border-border"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={commitEdit}>Save</Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
