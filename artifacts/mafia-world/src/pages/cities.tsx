import { useListCities, useTravelToCity, useGetMyProfile, getListCitiesQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Plane, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { getApiError } from "@/lib/apiError";
import { PageBanner } from "@/components/PageBanner";
import { getCityImage } from "@/lib/itemImages";

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
      <PageBanner image="/images/banners/cities.png" title={t("nav.cities")} />
      
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
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full bg-card" />)
        ) : cities?.map((city) => {
          const isCurrent = profile?.cityName === city.name;
          return (
            <Card key={city.id} className={`bg-card border-border flex flex-col transition-colors overflow-hidden ${isCurrent ? "border-primary" : "hover:border-primary/50"}`}>
              <div className="relative h-40 overflow-hidden">
                <img
                  src={city.imageUrl ?? getCityImage(city.name)}
                  alt={city.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = getCityImage(city.name); }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                {isCurrent && (
                  <Badge className="absolute top-2 right-2 bg-primary">{t("cities.currentCity")}</Badge>
                )}
                <div className="absolute bottom-2 left-3">
                  <p className="text-white font-heading uppercase tracking-wider font-bold text-lg drop-shadow-lg">
                    {language === "ar" ? city.nameAr : city.name}
                  </p>
                  <p className="text-white/70 text-xs">{city.country}</p>
                </div>
              </div>
              <CardContent className="flex-1 flex flex-col pt-4">
                <p className="text-sm text-muted-foreground flex-1 mb-4">{language === "ar" ? (city.descriptionAr || city.description) : city.description}</p>
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
