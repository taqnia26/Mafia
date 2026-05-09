import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t, language, setLanguage } = useI18n();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-luminosity"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background"></div>
      
      <header className="relative z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Mafia World" className="h-10 w-10" />
          <span className="font-heading font-bold text-2xl tracking-widest text-primary uppercase">{t("home.title")}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors border border-border/50 px-2 py-1 rounded"
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
          <Link href="/sign-in" className="text-sm font-medium hover:text-primary transition-colors">
            {t("home.signIn")}
          </Link>
          <Link href="/sign-up">
            <Button variant="default" className="font-heading uppercase tracking-wider">
              {t("home.playNow")}
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 relative z-10 flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            {t("home.hero1")} <span className="text-primary">{t("home.hero2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {t("home.tagline")}
          </p>
          <div className="pt-8">
            <Link href="/sign-up">
              <Button size="lg" className="h-16 px-12 text-xl font-heading uppercase tracking-widest shadow-[0_0_20px_rgba(139,0,0,0.5)] hover:shadow-[0_0_30px_rgba(139,0,0,0.8)] transition-all">
                {t("home.cta")}
              </Button>
            </Link>
          </div>
        </div>
      </main>
      
      <footer className="relative z-10 py-6 text-center text-muted-foreground text-sm border-t border-border/50">
        &copy; {new Date().getFullYear()} {t("home.title")}. {t("home.rights")}
      </footer>
    </div>
  );
}
