import { useListCities, useTravelToCity, useGetMyProfile, getListCitiesQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Plane, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getApiError } from "@/lib/apiError";

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
          title: t("cities.flightBooked"), 
          description: result.message,
        });
      },
      onError: (err: unknown) => {
        toast({ 
          title: t("cities.cannotTravel"), 
          description: getApiError(err),
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
                <p className="font-heading uppercase tracking-wider font-bold">{t("cities.inTransit")}</p>
                <p className="text-sm text-muted-foreground">{t("cities.inTransitDesc")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
        ) : cities?.map((city) => {
          const isCurrent = profile?.cityName === city.name;
          return (
            <Card key={city.id} className={`bg-card border-border flex flex-col transition-colors ${isCurrent ? "border-primary" : "hover:border-primary/50"}`}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-heading uppercase tracking-wider text-lg">
                      {language === "ar" ? city.nameAr : city.name}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{city.country}</CardDescription>
                  </div>
                  {isCurrent && <Badge className="bg-primary">{t("cities.currentCity")}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-0">
                <p className="text-sm text-muted-foreground flex-1 mb-4">{city.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Users className="w-4 h-4" />
                  <span>{city.playerCount} {t("common.players")}</span>
                  <MapPin className="w-4 h-4 ml-2" />
                </div>
                <Button 
                  className="w-full font-heading uppercase"
                  variant={isCurrent ? "secondary" : "default"}
                  disabled={isCurrent || travel.isPending || profile?.isTraveling === true}
                  onClick={() => travel.mutate({ data: { targetCityId: city.id } })}
                >
                  {isCurrent ? t("cities.youAreHere") : t("common.travel")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
