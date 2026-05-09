import { useListGangs, useCreateGang, useJoinGang, getListGangsQueryKey, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { getApiError } from "@/lib/apiError";

export default function Gangs() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newGangName, setNewGangName] = useState("");
  const [newGangDesc, setNewGangDesc] = useState("");

  const { data: gangs, isLoading } = useListGangs({ query: { queryKey: getListGangsQueryKey() } });
  
  const joinGang = useJoinGang({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGangsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        toast({ title: "Joined Gang", description: "You are now a member of the gang." });
      },
      onError: (err: unknown) => {
        toast({ title: "Cannot join gang", description: getApiError(err), variant: "destructive" });
      }
    }
  });

  const createGang = useCreateGang({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGangsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        setIsCreateOpen(false);
        setNewGangName("");
        setNewGangDesc("");
        toast({ title: "Gang Created", description: "Your gang has been established." });
      },
      onError: (err: unknown) => {
        toast({ title: "Cannot create gang", description: getApiError(err), variant: "destructive" });
      }
    }
  });

  const handleCreate = () => {
    if (!newGangName.trim()) return;
    createGang.mutate({ data: { name: newGangName, description: newGangDesc } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.gangs")}</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-heading uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> {t("common.create")}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-wider text-xl text-primary">{t("gangs.createGang")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input value={newGangName} onChange={(e) => setNewGangName(e.target.value)} placeholder="e.g. The Sopranos" className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>{t("common.description")}</Label>
                <Textarea value={newGangDesc} onChange={(e) => setNewGangDesc(e.target.value)} placeholder="Your gang's motto or rules..." className="bg-background resize-none" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCreate} disabled={!newGangName || createGang.isPending}>{t("gangs.createGang")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
        ) : gangs && gangs.length > 0 ? (
          gangs.map((gang) => (
            <Card key={gang.id} className="bg-card border-border hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-heading uppercase tracking-wider text-xl truncate">{gang.name}</CardTitle>
                  <Badge variant="secondary" className="flex items-center gap-1 font-mono">
                    <Users className="w-3 h-3" /> {gang.memberCount}
                  </Badge>
                </div>
                <CardDescription className="text-xs">{t("gangs.boss")}: <span className="font-bold text-foreground">{gang.bossName}</span></CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-0">
                <p className="text-sm text-muted-foreground flex-1 mb-4 line-clamp-2">{gang.description}</p>
                <div className="flex gap-2 mt-auto">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => joinGang.mutate({ gangId: gang.id })}
                    disabled={joinGang.isPending}
                  >
                    {t("common.join")}
                  </Button>
                  <Link href={`/gang/${gang.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full">{t("gangs.members")}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            {t("gangs.noGangs")}
          </div>
        )}
      </div>
    </div>
  );
}
