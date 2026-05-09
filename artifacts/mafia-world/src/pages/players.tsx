import { useState, useEffect } from "react";
import { useListPlayers, useSpyOnPlayer, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Swords, Shield, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

export default function Players() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [spiedPlayerId, setSpyiedPlayerId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useListPlayers({ search: debouncedSearch, limit: 20 }, { query: { queryKey: getListPlayersQueryKey({ search: debouncedSearch, limit: 20 }) } });
  
  const spy = useSpyOnPlayer({
    mutation: {
      onSuccess: (result) => {
        if (result.success && !result.blocked) {
          toast({
            title: "Spy Successful",
            description: `Target has ${result.attackPower} ATK and ${result.defensePower} DEF.`,
            className: "bg-green-900 border-green-500",
          });
          // In a real app we'd open a modal with the full result. For now, simple toast.
        } else if (result.blocked) {
          toast({
            title: "Spy Blocked",
            description: "The target has Anti-Spy enabled.",
            variant: "destructive",
          });
        }
      },
      onError: (err: any) => {
        toast({
          title: "Spy Failed",
          description: err?.response?.data?.error || "An error occurred",
          variant: "destructive",
        });
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.players")}</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search players..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-card" />)
        ) : data?.players && data.players.length > 0 ? (
          data.players.map((player) => (
            <Card key={player.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg font-heading uppercase">{player.username}</h3>
                    <p className="text-sm text-muted-foreground">Level {player.level} • {player.cityName}</p>
                  </div>
                  {player.gangName && (
                    <Badge variant="outline" className="border-primary/50 text-primary">{player.gangName}</Badge>
                  )}
                </div>
                
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> {player.killCount}</span>
                  <span className="flex items-center gap-1 text-destructive"><Swords className="w-3 h-3" /> {player.deathCount}</span>
                </div>

                <div className="mt-6 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 font-heading uppercase tracking-wider"
                    onClick={() => spy.mutate({ targetPlayerId: player.id })}
                    disabled={spy.isPending}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Spy
                  </Button>
                  <Link href={`/attack?target=${player.id}`} className="flex-1">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full font-heading uppercase tracking-wider"
                    >
                      <Swords className="w-4 h-4 mr-2" /> Attack
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            No players found.
          </div>
        )}
      </div>
    </div>
  );
}