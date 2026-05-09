import { useListArmorItems, useGetMyArmor, useBuyArmor, getListArmorItemsQueryKey, getGetMyArmorQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getApiError } from "@/lib/apiError";

export default function Armor() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shopArmor, isLoading: isShopLoading } = useListArmorItems({ query: { queryKey: getListArmorItemsQueryKey() } });
  const { data: myArmor, isLoading: isMyArmorLoading } = useGetMyArmor({ query: { queryKey: getGetMyArmorQueryKey() } });

  const buyArmor = useBuyArmor({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyArmorQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: t("common.success"), description: t("armor.purchased") });
      },
      onError: (err: unknown) => toast({ title: "Purchase Failed", description: getApiError(err), variant: "destructive" })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.armor")}</h1>
      </div>

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="shop" className="font-heading uppercase">{t("armor.buyArmor")}</TabsTrigger>
          <TabsTrigger value="inventory" className="font-heading uppercase">{t("armor.myArmor")}</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isShopLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
            ) : shopArmor?.map((a) => (
              <Card key={a.id} className="bg-card border-border flex flex-col hover:border-blue-500/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-heading uppercase tracking-wider text-base">{a.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-blue-400 border-blue-400/50">+{a.defenseBonus} DEF</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground">
                  <p>{t("armor.defenseBonus")}: <span className="text-blue-400 font-bold">+{a.defenseBonus}</span></p>
                </CardContent>
                <CardFooter className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-green-500 font-mono font-bold">${a.price.toLocaleString()}</span>
                  <Button size="sm" className="font-heading uppercase" onClick={() => buyArmor.mutate({ armorId: a.id, data: { quantity: 1 } })} disabled={buyArmor.isPending}>
                    {t("common.buy")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2"><Shield className="w-5 h-5 text-blue-400"/> {t("armor.myArmor")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isMyArmorLoading ? (
                <div className="p-4 space-y-2"><Skeleton className="h-12 w-full bg-secondary" /></div>
              ) : myArmor && myArmor.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {myArmor.map((a) => (
                    <div key={a.armorId} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold font-heading uppercase">{a.armorName}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">{t("common.quantity")}: {a.quantity}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <Badge variant="outline" className="font-mono text-blue-400 border-blue-400/50">+{a.defenseBonus} DEF</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">{t("armor.noArmor")}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
