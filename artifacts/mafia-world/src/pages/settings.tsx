import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { signOut } = useClerk();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.settings")}</h1>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider text-lg">{t("settings.preferences")}</CardTitle>
          <CardDescription>{t("settings.preferencesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="language">{t("settings.language")}</Label>
            <Select value={language} onValueChange={(val: "en" | "ar") => setLanguage(val)}>
              <SelectTrigger id="language" className="w-full bg-secondary border-border">
                <SelectValue placeholder={t("settings.selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.englishLabel")}</SelectItem>
                <SelectItem value="ar">{t("settings.arabicLabel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-destructive/20">
        <CardHeader>
          <CardTitle className="font-heading uppercase tracking-wider text-lg text-destructive">{t("settings.account")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => signOut()} className="w-full sm:w-auto">
            {t("settings.signOutBtn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
