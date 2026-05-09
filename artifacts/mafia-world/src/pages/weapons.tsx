import { useListWeapons, useGetMyWeapons, useListAmmo, useGetMyAmmo, useBuyWeapon, useBuyAmmo, getListWeaponsQueryKey, getGetMyWeaponsQueryKey, getListAmmoQueryKey, getGetMyAmmoQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Crosshair, Package, Shield, Swords, Battery } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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
        toast({ title: "Purchase Successful", description: "Weapon added to your arsenal." });
      },
      onError: (err: any) => toast({ title: "Purchase Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  const buyAmmo = useBuyAmmo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyAmmoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: "Purchase Successful", description: "Ammo added to stash." });
      },
      onError: (err: any) => toast({ title: "Purchase Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.weapons")}</h1>
      </div>

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="shop" className="font-heading uppercase">Black Market Shop</TabsTrigger>
          <TabsTrigger value="inventory" className="font-heading uppercase">My Arsenal</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-8 mt-6">
          <div>
            <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2"><Swords className="w-5 h-5"/> Weapons</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isWeaponsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
              ) : shopWeapons?.map((w) => (
                <Card key={w.id} className="bg-card border-border flex flex-col hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase">{w.name}</CardTitle>
                    <Badge variant="outline" className="w-fit">{w.type.replace('_', ' ')}</Badge>
                  </CardHeader>
                  <CardContent className="flex-1 pb-2">
                    <p className="text-sm text-muted-foreground mb-4">{w.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-orange-500"><Crosshair className="w-4 h-4"/> +{w.attackPower} ATK</span>
                      <span className="font-mono text-green-500 font-bold">${w.price.toLocaleString()}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full font-heading uppercase" 
                      onClick={() => buyWeapon.mutate({ weaponId: w.id, data: { quantity: 1 } })}
                      disabled={buyWeapon.isPending}
                    >
                      Buy
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-heading text-primary mb-4 flex items-center gap-2"><Battery className="w-5 h-5"/> Ammunition</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isAmmoLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
              ) : shopAmmo?.map((a) => (
                <Card key={a.id} className="bg-card border-border flex flex-col hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading uppercase">{a.name}</CardTitle>
                    <Badge variant="secondary" className="w-fit">{a.type}</Badge>
                  </CardHeader>
                  <CardContent className="flex-1 pb-2">
                    <p className="text-sm text-muted-foreground mb-4">{a.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-orange-400">+{a.damageBonus} DMG Bonus</span>
                      <span className="font-mono text-green-500 font-bold">${a.price.toLocaleString()}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      variant="secondary"
                      className="w-full font-heading uppercase" 
                      onClick={() => buyAmmo.mutate({ ammoId: a.id, data: { quantity: 10 } })}
                      disabled={buyAmmo.isPending}
                    >
                      Buy x10
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-8 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading uppercase flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Owned Weapons</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isMyWeaponsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full bg-secondary" />
                  </div>
                ) : myWeapons && myWeapons.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {myWeapons.map((w) => (
                      <div key={w.id} className="p-4 flex items-center justify-between hover:bg-secondary/20">
                        <div>
                          <p className="font-bold font-heading uppercase">{w.weaponName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Crosshair className="w-3 h-3 text-orange-500" /> +{w.attackPower} ATK
                          </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-lg">x{w.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No weapons in arsenal.</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading uppercase flex items-center gap-2"><Battery className="w-5 h-5 text-yellow-500" /> Ammunition Stash</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isMyAmmoLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full bg-secondary" />
                  </div>
                ) : myAmmo && myAmmo.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {myAmmo.map((a) => (
                      <div key={a.id} className="p-4 flex items-center justify-between hover:bg-secondary/20">
                        <div>
                          <p className="font-bold font-heading uppercase">{a.ammoName}</p>
                          <p className="text-xs text-muted-foreground mt-1 capitalize">{a.ammoType} rounds</p>
                        </div>
                        <Badge className="bg-yellow-600 text-yellow-50 font-mono text-lg">x{a.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No ammo in stash.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}