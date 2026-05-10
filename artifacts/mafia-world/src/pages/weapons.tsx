import { useListWeapons, useGetMyWeapons, useListAmmo, useGetMyAmmo, useBuyWeapon, useBuyAmmo, getListWeaponsQueryKey, getGetMyWeaponsQueryKey, getListAmmoQueryKey, getGetMyAmmoQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, Swords, Battery } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getApiError } from "@/lib/apiError";
import { PageBanner } from "@/components/PageBanner";
import { getWeaponImage, getAmmoImage } from "@/lib/itemImages";

export default function Weapons() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopWeapons, isLoading: isWeaponsLoading } = useListWeapons({ query: { queryKey: getListWeaponsQueryKey() } });
  const { data: myWeapons, isLoading: isMyWeaponsLoading } = useGetMyWeapons({ query: { queryKey: getGetMyWeaponsQueryKey() } });
  const { data: shopAmmo, isLoading: isAmmoLoading } = useListAmmo({ query: { queryKey: getListAmmoQueryKey() } });
  const { data: myAmmo, isLoading: isMyAmmoLoading } = useGetMyAmmo({ query: { queryKey: getGetMyAmmoQueryKey() } });

  const buyWeapon = useBuyWeapon({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyWeaponsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: t("common.success"), description: t("weapons.buyWeaponSuccess") });
      },
      onError: (err: unknown) => toast({ title: t("common.purchaseFailed"), description: getApiError(err), variant: "destructive" })
    }
  });

  const buyAmmo = useBuyAmmo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyAmmoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: t("common.success"), description: t("weapons.buyAmmoSuccess") });
      },
      onError: (err: unknown) => toast({ title: t("common.purchaseFailed"), description: getApiError(err), variant: "destructive" })
    }
  });

  return (
    <div className="space-y-6">
      <PageBanner image="/images/banners/weapons.png" title={t("nav.weapons")} />

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="shop" className="font-heading uppercase">{t("weapons.shop")}</TabsTrigger>
          <TabsTrigger value="inventory" className="font-heading uppercase">{t("weapons.myWeapons")}</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-8 mt-6">
          <div>
            <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2"><Swords className="w-5 h-5"/> {t("weapons.title")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isWeaponsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-full bg-card" />)
              ) : shopWeapons?.map((w) => (
                <Card key={w.id} className="bg-card border-border flex flex-col hover:border-primary/50 transition-colors overflow-hidden">
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={w.imageUrl ?? getWeaponImage(w.name)}
                      alt={w.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getWeaponImage(w.name); }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                    <Badge variant="outline" className="absolute top-2 right-2 font-mono text-destructive border-destructive/50 bg-card/80">+{w.attackPower} {t("common.atkAbbr")}</Badge>
                  </div>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="font-heading uppercase tracking-wider text-base">{w.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground space-y-1">
                    <p>{t("weapons.ammoType")}: <span className="text-foreground font-medium">{w.ammoType}</span></p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-green-500 font-mono font-bold">${w.price.toLocaleString("en-US")}</span>
                    <Button size="sm" className="font-heading uppercase" onClick={() => buyWeapon.mutate({ weaponId: w.id, data: { quantity: 1 } })} disabled={buyWeapon.isPending}>
                      {t("common.buy")}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2"><Battery className="w-5 h-5"/> {t("weapons.buyAmmo")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isAmmoLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
              ) : shopAmmo?.map((a) => (
                <Card key={a.id} className="bg-card border-border hover:border-primary/50 transition-colors flex flex-col overflow-hidden">
                  <div className="relative h-28 overflow-hidden">
                    <img
                      src={a.imageUrl ?? getAmmoImage(a.name)}
                      alt={a.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getAmmoImage(a.name); }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  </div>
                  <CardHeader className="pb-2 pt-3">
                    <CardTitle className="font-heading uppercase tracking-wider text-base">{a.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground">
                    <p>{t("weapons.damageBonus")}: <span className="text-orange-400 font-bold">+{a.damageBonus}</span></p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-green-500 font-mono font-bold">${a.price.toLocaleString("en-US")}</span>
                    <Button size="sm" className="font-heading uppercase" onClick={() => buyAmmo.mutate({ ammoId: a.id, data: { quantity: 10 } })} disabled={buyAmmo.isPending}>
                      {t("common.buy")}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading uppercase flex items-center gap-2"><Swords className="w-5 h-5 text-primary"/> {t("weapons.myWeapons")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isMyWeaponsLoading ? (
                  <div className="p-4 space-y-2"><Skeleton className="h-12 w-full bg-secondary" /></div>
                ) : myWeapons && myWeapons.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {myWeapons.map((w) => (
                      <div key={w.weaponId} className="p-4 flex items-center gap-3">
                        <img
                          src={getWeaponImage(w.weaponName ?? "")}
                          alt={w.weaponName ?? ""}
                          className="w-12 h-12 object-cover rounded border border-border/50"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="flex-1">
                          <p className="font-bold font-heading uppercase">{w.weaponName}</p>
                          <p className="text-xs text-muted-foreground">{t("common.quantity")}: {w.quantity}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-destructive border-destructive/50">+{w.attackPower} {t("common.atkAbbr")}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">{t("weapons.noWeapons")}</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading uppercase flex items-center gap-2"><Package className="w-5 h-5 text-orange-500"/> {t("weapons.totalAmmo")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isMyAmmoLoading ? (
                  <div className="p-4 space-y-2"><Skeleton className="h-12 w-full bg-secondary" /></div>
                ) : myAmmo && myAmmo.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {myAmmo.map((a) => (
                      <div key={a.ammoId} className="p-4 flex items-center gap-3">
                        <img
                          src={getAmmoImage(a.ammoName ?? "")}
                          alt={a.ammoName ?? ""}
                          className="w-12 h-12 object-cover rounded border border-border/50"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <p className="flex-1 font-bold font-heading uppercase">{a.ammoName}</p>
                        <Badge variant="secondary" className="font-mono">x{a.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">{t("weapons.noAmmo")}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
