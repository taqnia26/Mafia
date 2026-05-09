import { createContext, useContext, useState, ReactNode, useEffect } from "react";

type Language = "en" | "ar";

interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}

const translations: Translations = {
  "app.title": { en: "MAFIA WORLD", ar: "عالم المافيا" },
  "nav.dashboard": { en: "Dashboard", ar: "لوحة القيادة" },
  "nav.profile": { en: "Profile", ar: "الملف الشخصي" },
  "nav.players": { en: "Players", ar: "اللاعبين" },
  "nav.gangs": { en: "Gangs", ar: "العصابات" },
  "nav.weapons": { en: "Weapons", ar: "الأسلحة" },
  "nav.armor": { en: "Armor", ar: "الدروع" },
  "nav.bodyguards": { en: "Bodyguards", ar: "الحراس" },
  "nav.attack": { en: "Attack", ar: "هجوم" },
  "nav.blackmarket": { en: "Black Market", ar: "السوق السوداء" },
  "nav.crimes": { en: "Crimes", ar: "الجرائم" },
  "nav.prison": { en: "Prison", ar: "السجن" },
  "nav.cities": { en: "Cities", ar: "المدن" },
  "nav.settings": { en: "Settings", ar: "الإعدادات" },
  "nav.logout": { en: "Sign Out", ar: "تسجيل الخروج" },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("mw_lang");
    return (saved as Language) || "en";
  });

  useEffect(() => {
    localStorage.setItem("mw_lang", language);
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language] || key;
    }
    return key;
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        dir: language === "ar" ? "rtl" : "ltr",
      }}
    >
      <div dir={language === "ar" ? "rtl" : "ltr"}>{children}</div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
