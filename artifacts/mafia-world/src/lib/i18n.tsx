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
  "nav.admin": { en: "Admin", ar: "الإدارة" },

  "common.loading": { en: "Loading...", ar: "جار التحميل..." },
  "common.error": { en: "Error", ar: "خطأ" },
  "common.success": { en: "Success", ar: "نجاح" },
  "common.cancel": { en: "Cancel", ar: "إلغاء" },
  "common.confirm": { en: "Confirm", ar: "تأكيد" },
  "common.save": { en: "Save", ar: "حفظ" },
  "common.buy": { en: "Buy", ar: "شراء" },
  "common.sell": { en: "Sell", ar: "بيع" },
  "common.quantity": { en: "Quantity", ar: "الكمية" },
  "common.price": { en: "Price", ar: "السعر" },
  "common.back": { en: "Back", ar: "رجوع" },
  "common.level": { en: "Level", ar: "المستوى" },
  "common.money": { en: "Money", ar: "المال" },
  "common.attack": { en: "Attack", ar: "هجوم" },
  "common.defense": { en: "Defense", ar: "دفاع" },
  "common.kills": { en: "Kills", ar: "القتلى" },
  "common.deaths": { en: "Deaths", ar: "الوفيات" },
  "common.status": { en: "Status", ar: "الحالة" },
  "common.city": { en: "City", ar: "المدينة" },
  "common.gang": { en: "Gang", ar: "العصابة" },
  "common.rank": { en: "Rank", ar: "الرتبة" },
  "common.hire": { en: "Hire", ar: "توظيف" },
  "common.dismiss": { en: "Dismiss", ar: "طرد" },
  "common.join": { en: "Join", ar: "انضمام" },
  "common.leave": { en: "Leave", ar: "مغادرة" },
  "common.create": { en: "Create", ar: "إنشاء" },
  "common.name": { en: "Name", ar: "الاسم" },
  "common.description": { en: "Description", ar: "الوصف" },
  "common.travel": { en: "Travel", ar: "سفر" },
  "common.players": { en: "Players", ar: "اللاعبين" },
  "common.search": { en: "Search", ar: "بحث" },
  "common.none": { en: "None", ar: "لا شيء" },

  "dashboard.title": { en: "Dashboard", ar: "لوحة القيادة" },
  "dashboard.welcome": { en: "Welcome back", ar: "مرحباً بعودتك" },
  "dashboard.stats": { en: "Stats Overview", ar: "نظرة عامة على الإحصائيات" },
  "dashboard.activity": { en: "Recent Activity", ar: "النشاط الأخير" },
  "dashboard.leaderboard": { en: "Leaderboard", ar: "لوحة المتصدرين" },
  "dashboard.xp": { en: "XP", ar: "نقاط الخبرة" },
  "dashboard.weaponCount": { en: "Weapons", ar: "الأسلحة" },
  "dashboard.ammoCount": { en: "Ammo", ar: "الذخيرة" },
  "dashboard.bodyguards": { en: "Bodyguards", ar: "الحراس" },
  "dashboard.pendingAttacks": { en: "Outgoing Attacks", ar: "الهجمات الصادرة" },
  "dashboard.incomingAttacks": { en: "Incoming Attacks", ar: "الهجمات الواردة" },

  "weapons.title": { en: "Weapons Shop", ar: "متجر الأسلحة" },
  "weapons.myWeapons": { en: "My Arsenal", ar: "ترسانتي" },
  "weapons.shop": { en: "Shop", ar: "المتجر" },
  "weapons.attackPower": { en: "Attack Power", ar: "قوة الهجوم" },
  "weapons.ammoType": { en: "Ammo Type", ar: "نوع الذخيرة" },
  "weapons.buyWeapon": { en: "Buy Weapon", ar: "شراء سلاح" },
  "weapons.buyAmmo": { en: "Buy Ammo", ar: "شراء ذخيرة" },
  "weapons.totalAmmo": { en: "Total Ammo", ar: "إجمالي الذخيرة" },
  "weapons.damageBonus": { en: "Damage Bonus", ar: "مكافأة الضرر" },

  "armor.title": { en: "Armor Shop", ar: "متجر الدروع" },
  "armor.myArmor": { en: "My Protection", ar: "حمايتي" },
  "armor.defenseBonus": { en: "Defense Bonus", ar: "مكافأة الدفاع" },
  "armor.buyArmor": { en: "Buy Armor", ar: "شراء درع" },

  "bodyguards.title": { en: "Bodyguards", ar: "الحراس الشخصيون" },
  "bodyguards.npcGuards": { en: "Hire NPC Guards", ar: "استئجار حراس" },
  "bodyguards.myGuards": { en: "My Guards", ar: "حراسي" },
  "bodyguards.requests": { en: "Guard Requests", ar: "طلبات الحراسة" },
  "bodyguards.defensePower": { en: "Defense Power", ar: "قوة الدفاع" },
  "bodyguards.hirePrice": { en: "Hire Price", ar: "سعر التوظيف" },
  "bodyguards.tier": { en: "Tier", ar: "الفئة" },

  "gangs.title": { en: "Gangs", ar: "العصابات" },
  "gangs.createGang": { en: "Create Gang", ar: "إنشاء عصابة" },
  "gangs.myGang": { en: "My Gang", ar: "عصابتي" },
  "gangs.treasury": { en: "Treasury", ar: "الخزانة" },
  "gangs.members": { en: "Members", ar: "الأعضاء" },
  "gangs.boss": { en: "Boss", ar: "الرئيس" },
  "gangs.deposit": { en: "Deposit to Treasury", ar: "إيداع في الخزانة" },
  "gangs.promote": { en: "Promote Member", ar: "ترقية عضو" },
  "gangs.leaveGang": { en: "Leave Gang", ar: "مغادرة العصابة" },

  "attack.title": { en: "Attack", ar: "الهجوم" },
  "attack.selectTarget": { en: "Select Target", ar: "اختر الهدف" },
  "attack.selectWeapon": { en: "Select Weapon", ar: "اختر السلاح" },
  "attack.ammoQuantity": { en: "Ammo to Use", ar: "الذخيرة المستخدمة" },
  "attack.initiateAttack": { en: "Launch Attack", ar: "شن الهجوم" },
  "attack.traveling": { en: "Traveling to target...", ar: "في الطريق إلى الهدف..." },
  "attack.myAttacks": { en: "My Attacks", ar: "هجماتي" },
  "attack.incoming": { en: "Incoming Attacks", ar: "الهجمات الواردة" },
  "attack.won": { en: "Won", ar: "فاز" },
  "attack.lost": { en: "Lost", ar: "خسر" },
  "attack.cancelled": { en: "Cancelled", ar: "ملغي" },

  "blackmarket.title": { en: "Black Market", ar: "السوق السوداء" },
  "blackmarket.listings": { en: "Listings", ar: "العروض" },
  "blackmarket.myListings": { en: "My Listings", ar: "عروضي" },
  "blackmarket.createListing": { en: "Create Listing", ar: "إنشاء عرض" },
  "blackmarket.itemType": { en: "Item Type", ar: "نوع العنصر" },
  "blackmarket.seller": { en: "Seller", ar: "البائع" },
  "blackmarket.buyNow": { en: "Buy Now", ar: "اشتر الآن" },
  "blackmarket.cancelListing": { en: "Cancel Listing", ar: "إلغاء العرض" },

  "crimes.title": { en: "Crimes", ar: "الجرائم" },
  "crimes.attempt": { en: "Attempt Crime", ar: "محاولة جريمة" },
  "crimes.history": { en: "Crime History", ar: "سجل الجرائم" },
  "crimes.reward": { en: "Reward", ar: "المكافأة" },
  "crimes.successRate": { en: "Success Rate", ar: "معدل النجاح" },
  "crimes.prisonRisk": { en: "Prison Risk", ar: "خطر السجن" },
  "crimes.cooldown": { en: "Cooldown", ar: "فترة الانتظار" },
  "crimes.requiredLevel": { en: "Required Level", ar: "المستوى المطلوب" },
  "crimes.caught": { en: "Caught!", ar: "تم القبض عليك!" },
  "crimes.escaped": { en: "Escaped", ar: "هربت" },
  "crimes.success": { en: "Success!", ar: "نجاح!" },

  "prison.title": { en: "Prison", ar: "السجن" },
  "prison.releaseIn": { en: "Release In", ar: "الإفراج في" },
  "prison.crime": { en: "Crime Committed", ar: "الجريمة المرتكبة" },
  "prison.jailbreak": { en: "Jailbreak", ar: "كسر السجن" },
  "prison.bribe": { en: "Bribe Guard", ar: "رشوة الحارس" },
  "prison.raid": { en: "Prison Raid", ar: "اقتحام السجن" },
  "prison.free": { en: "You are free!", ar: "أنت حر!" },

  "cities.title": { en: "Cities", ar: "المدن" },
  "cities.travel": { en: "Travel", ar: "سفر" },
  "cities.currentCity": { en: "Current City", ar: "المدينة الحالية" },
  "cities.travelTime": { en: "Travel Time", ar: "وقت السفر" },
  "cities.population": { en: "Players in City", ar: "اللاعبون في المدينة" },
  "cities.traveling": { en: "Currently Traveling", ar: "في رحلة حالياً" },

  "profile.title": { en: "Profile", ar: "الملف الشخصي" },
  "profile.username": { en: "Username", ar: "اسم المستخدم" },
  "profile.updateUsername": { en: "Update Username", ar: "تحديث اسم المستخدم" },
  "profile.antiSpy": { en: "Anti-Spy Mode", ar: "وضع مكافحة التجسس" },
  "profile.antiSpyDesc": { en: "Prevent others from spying on your stats", ar: "منع الآخرين من التجسس على إحصائياتك" },

  "settings.title": { en: "Settings", ar: "الإعدادات" },
  "settings.language": { en: "Language", ar: "اللغة" },
  "settings.english": { en: "English", ar: "الإنجليزية" },
  "settings.arabic": { en: "Arabic", ar: "العربية" },
  "settings.theme": { en: "Theme", ar: "المظهر" },

  "players.title": { en: "Players", ar: "اللاعبين" },
  "players.spy": { en: "Spy", ar: "تجسس" },
  "players.attack": { en: "Attack", ar: "هجوم" },
  "players.inPrison": { en: "In Prison", ar: "في السجن" },
  "players.traveling": { en: "Traveling", ar: "مسافر" },

  "admin.title": { en: "Admin Panel", ar: "لوحة الإدارة" },
  "admin.stats": { en: "Server Stats", ar: "إحصائيات الخادم" },
  "admin.managePlayers": { en: "Manage Players", ar: "إدارة اللاعبين" },
  "admin.manageGangs": { en: "Manage Gangs", ar: "إدارة العصابات" },
  "admin.totalPlayers": { en: "Total Players", ar: "إجمالي اللاعبين" },
  "admin.totalGangs": { en: "Total Gangs", ar: "إجمالي العصابات" },
  "admin.totalAttacks": { en: "Total Attacks", ar: "إجمالي الهجمات" },
  "admin.prisoners": { en: "Prisoners", ar: "السجناء" },
  "admin.economy": { en: "Total Money in Circulation", ar: "إجمالي الأموال المتداولة" },
  "admin.release": { en: "Release from Prison", ar: "الإفراج من السجن" },
  "admin.resetStats": { en: "Reset Stats", ar: "إعادة تعيين الإحصائيات" },
  "admin.ban": { en: "Jail Player", ar: "سجن اللاعب" },
  "admin.grantAdmin": { en: "Grant Admin", ar: "منح صلاحيات الإدارة" },
  "admin.revokeAdmin": { en: "Revoke Admin", ar: "إلغاء صلاحيات الإدارة" },
  "admin.disband": { en: "Disband Gang", ar: "حل العصابة" },
  "admin.notAdmin": { en: "You do not have admin privileges.", ar: "ليس لديك صلاحيات الإدارة." },
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
