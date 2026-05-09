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
        toast({ title: "Purchase Successful", description: "Armor added to your inventory." });
      },
      onError: (err: any) => toast({ title: "Purchase Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.armor")}</h1>
      </div>

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="shop" className="font-heading uppercase">Dealer</TabsTrigger>
          <TabsTrigger value="inventory" className="font-heading uppercase">My Armor</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isShopLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
            ) : shopArmor?.map((a) => (
              <Card key={a.id} className="bg-card border-border flex flex-col hover:border-blue-500/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading uppercase">{a.name}</CardTitle>
                  <Badge variant="outline" className="w-fit text-blue-400 border-blue-400/30">{a.type.replace('_', ' ')}</Badge>
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                  <p className="text-sm text-muted-foreground mb-4">{a.description}</p>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1 text-blue-500"><Shield className="w-4 h-4"/> +{a.defenseBonus} DEF</span>
                    <span className="font-mono text-green-500 font-bold">${a.price.toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full font-heading uppercase bg-blue-900 hover:bg-blue-800 text-white" 
                    onClick={() => buyArmor.mutate({ armorId: a.id, data: { quantity: 1 } })}
                    disabled={buyArmor.isPending}
                  >
                    Buy
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <Card className="bg-card border-border max-w-3xl">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2"><Package className="w-5 h-5 text-blue-500" /> Owned Armor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isMyArmorLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-12 w-full bg-secondary" />
                </div>
              ) : myArmor && myArmor.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {myArmor.map((a) => (
                    <div key={a.id} className="p-4 flex items-center justify-between hover:bg-secondary/20">
                      <div>
                        <p className="font-bold font-heading uppercase">{a.armorName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Shield className="w-3 h-3 text-blue-500" /> +{a.defenseBonus} DEF
                        </p>
                      </div>
                      <Badge variant="outline" className="font-mono text-lg text-blue-400 border-blue-400/50">x{a.quantity}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">No armor owned. You are vulnerable.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}