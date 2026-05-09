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
      onError: (err: unknown) => toast({ title: "Purchase Failed", description: getApiError(err), variant: "destructive" })
    }
  });

  const buyAmmo = useBuyAmmo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyAmmoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: t("common.success"), description: t("weapons.buyAmmoSuccess") });
      },
      onError: (err: unknown) => toast({ title: "Purchase Failed", description: getApiError(err), variant: "destructive" })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.weapons")}</h1>
      </div>

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
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
              ) : shopWeapons?.map((w) => (
                <Card key={w.id} className="bg-card border-border flex flex-col hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-heading uppercase tracking-wider text-base">{w.name}</CardTitle>
                      <Badge variant="outline" className="font-mono text-destructive border-destructive/50">+{w.attackPower} ATK</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground space-y-1">
                    <p>{t("weapons.ammoType")}: <span className="text-foreground font-medium">{w.ammoType}</span></p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-green-500 font-mono font-bold">${w.price.toLocaleString()}</span>
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
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full bg-card" />)
              ) : shopAmmo?.map((a) => (
                <Card key={a.id} className="bg-card border-border hover:border-primary/50 transition-colors flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase tracking-wider text-base">{a.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground">
                    <p>{t("weapons.damageBonus")}: <span className="text-orange-400 font-bold">+{a.damageBonus}</span></p>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-green-500 font-mono font-bold">${a.price.toLocaleString()}</span>
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
                      <div key={w.weaponId} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold font-heading uppercase">{w.weaponName}</p>
                          <p className="text-xs text-muted-foreground">{t("common.quantity")}: {w.quantity}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-destructive border-destructive/50">+{w.attackPower} ATK</Badge>
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
                      <div key={a.ammoId} className="p-4 flex justify-between items-center">
                        <p className="font-bold font-heading uppercase">{a.ammoName}</p>
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
