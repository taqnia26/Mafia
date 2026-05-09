import { useListNpcBodyguards, useGetMyBodyguards, useHireNpcBodyguard, getListNpcBodyguardsQueryKey, getGetMyBodyguardsQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Bodyguards() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: npcs, isLoading: isNpcsLoading } = useListNpcBodyguards({ query: { queryKey: getListNpcBodyguardsQueryKey() } });
  const { data: myGuards, isLoading: isMyGuardsLoading } = useGetMyBodyguards({ query: { queryKey: getGetMyBodyguardsQueryKey() } });

  const hireNpc = useHireNpcBodyguard({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyBodyguardsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Guard Hired", description: "NPC bodyguard has been assigned to your detail." });
      },
      onError: (err: any) => toast({ title: "Hire Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.bodyguards")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-heading uppercase text-primary mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5"/> Hire NPC Guards</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {isNpcsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card" />)
            ) : npcs?.map((npc) => (
              <Card key={npc.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold font-heading uppercase">{npc.name}</h3>
                      <Badge variant={npc.tier === 'elite' ? 'destructive' : npc.tier === 'advanced' ? 'default' : 'secondary'} className="uppercase">
                        {npc.tier}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{npc.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm font-mono">
                      <span className="flex items-center gap-1 text-blue-500"><Shield className="w-4 h-4"/> +{npc.defensePower} DEF</span>
                    </div>
                  </div>
                  <div className="bg-secondary/30 p-6 flex flex-col justify-center sm:border-l border-border/50 sm:w-48 gap-3">
                    <div className="text-center font-mono">
                      <p className="text-green-500 font-bold">${npc.hirePrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">${npc.dailyCost.toLocaleString()}/day</p>
                    </div>
                    <Button 
                      className="w-full font-heading uppercase"
                      onClick={() => hireNpc.mutate({ guardId: npc.id })}
                      disabled={hireNpc.isPending}
                    >
                      Hire
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <Card className="bg-card border-border sticky top-4">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Active Detail</CardTitle>
              <CardDescription>Guards currently protecting you</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isMyGuardsLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-16 w-full bg-secondary" />
                </div>
              ) : (myGuards?.npcGuards.length === 0 && myGuards?.playerGuards.length === 0) ? (
                <div className="p-8 text-center text-muted-foreground">You have no active bodyguards.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {myGuards?.npcGuards.map((guard) => (
                    <div key={guard.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-bold font-heading uppercase">{guard.npcName}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">{guard.tier}</Badge>
                          <span className="text-xs text-blue-500 flex items-center gap-1"><Shield className="w-3 h-3"/> +{guard.defensePower}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Hired: {new Date(guard.hiredAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {myGuards?.playerGuards.map((guard) => (
                    <div key={guard.id} className="p-4 flex items-center justify-between bg-primary/5">
                      <div>
                        <p className="font-bold font-heading uppercase flex items-center gap-2">
                          {guard.guardUsername} <Badge className="bg-primary hover:bg-primary h-4 text-[10px]">Player</Badge>
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Lvl {guard.level}</span>
                          <span className="text-xs text-blue-500 flex items-center gap-1"><Shield className="w-3 h-3"/> +{guard.defensePower}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}