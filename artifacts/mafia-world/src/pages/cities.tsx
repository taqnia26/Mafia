import { useListCities, useTravelToCity, useGetMyProfile, getListCitiesQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Plane, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Cities() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: cities, isLoading } = useListCities({ query: { queryKey: getListCitiesQueryKey() } });
  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  
  const travel = useTravelToCity({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ 
          title: "Flight Booked", 
          description: result.message,
        });
      },
      onError: (error: any) => {
        toast({ 
          title: "Cannot travel", 
          description: error?.response?.data?.error || "An error occurred",
          variant: "destructive"
        });
      }
    }
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.cities")}</h1>
      </div>
      
      {profile?.isTraveling && (
        <Card className="bg-primary/10 border-primary">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full animate-pulse">
                <Plane className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold font-heading uppercase text-primary">In Transit</h3>
                <p className="text-sm text-muted-foreground">You are currently traveling. Arriving at {new Date(profile.travelArrivalAt!).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
        ) : cities?.map((city) => {
          const isCurrentCity = profile?.cityId === city.id;
          
          return (
            <Card key={city.id} className={`bg-card border-border overflow-hidden transition-all ${isCurrentCity ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/50'}`}>
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-heading uppercase tracking-wider text-xl flex items-center gap-2">
                      <MapPin className={`w-5 h-5 ${isCurrentCity ? 'text-primary' : 'text-muted-foreground'}`} />
                      {language === 'ar' ? city.nameAr : city.name}
                    </CardTitle>
                    <CardDescription>{city.country}</CardDescription>
                  </div>
                  {isCurrentCity && <Badge className="bg-primary hover:bg-primary">Current</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <p className="text-sm text-muted-foreground h-10 line-clamp-2">{city.description}</p>
                
                <div className="flex justify-between items-center bg-secondary/50 p-3 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Population</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{city.playerCount}</span>
                </div>
                
                <Button 
                  className="w-full font-heading tracking-widest uppercase"
                  variant={isCurrentCity ? "outline" : "default"}
                  disabled={isCurrentCity || profile?.isTraveling || travel.isPending}
                  onClick={() => travel.mutate({ data: { targetCityId: city.id } })}
                >
                  {isCurrentCity ? "Already Here" : "Travel Here"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}