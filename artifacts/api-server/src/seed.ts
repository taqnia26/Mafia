import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import * as schema from "@workspace/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const CRIME_DATA = [
  { name: "Pickpocket", description: "Lift wallets from unsuspecting tourists. Low risk, low reward.", minReward: 100, maxReward: 500, xpReward: 10, successRate: 0.90, prisonTimeHours: 1, cooldownMinutes: 10, requiredLevel: 1 },
  { name: "Car Theft", description: "Steal a vehicle and sell it for parts. Quick cash if you can hotwire it.", minReward: 600, maxReward: 2500, xpReward: 30, successRate: 0.78, prisonTimeHours: 3, cooldownMinutes: 25, requiredLevel: 2 },
  { name: "Store Robbery", description: "Rob the register at gunpoint. Requires nerve and speed.", minReward: 2000, maxReward: 6000, xpReward: 70, successRate: 0.65, prisonTimeHours: 6, cooldownMinutes: 50, requiredLevel: 4 },
  { name: "Armed Robbery", description: "Hold up a target at gunpoint. Higher stakes, bigger payout.", minReward: 5000, maxReward: 15000, xpReward: 130, successRate: 0.55, prisonTimeHours: 10, cooldownMinutes: 90, requiredLevel: 7 },
  { name: "Bank Heist", description: "Plan and execute a full bank robbery. High risk, massive reward.", minReward: 12000, maxReward: 40000, xpReward: 220, successRate: 0.42, prisonTimeHours: 16, cooldownMinutes: 150, requiredLevel: 10 },
  { name: "Arms Smuggling", description: "Move illegal weapons across state lines. Lucrative underworld trade.", minReward: 30000, maxReward: 90000, xpReward: 380, successRate: 0.32, prisonTimeHours: 20, cooldownMinutes: 240, requiredLevel: 15 },
  { name: "Assassination Contract", description: "A contract killing for a rival family. The highest paying crime in the underworld.", minReward: 70000, maxReward: 200000, xpReward: 600, successRate: 0.22, prisonTimeHours: 24, cooldownMinutes: 360, requiredLevel: 20 },
];

async function seed() {
  console.log("Seeding database...");

  const existingCities = await db.select().from(schema.citiesTable);
  if (existingCities.length === 0) {
    await db.insert(schema.citiesTable).values([
      { name: "New York", nameAr: "نيويورك", country: "USA", description: "The city that never sleeps. Home to the most powerful crime families.", travelHoursBase: 4, imageUrl: "/images/cities/new-york.png" },
      { name: "Chicago", nameAr: "شيكاغو", country: "USA", description: "The Windy City. Known for bootleggers and organized crime since Prohibition.", travelHoursBase: 5, imageUrl: "/images/cities/chicago.png" },
      { name: "Las Vegas", nameAr: "لاس فيغاس", country: "USA", description: "The city of sin. Where fortunes are made and lost overnight.", travelHoursBase: 6, imageUrl: "/images/cities/las-vegas.png" },
      { name: "Miami", nameAr: "ميامي", country: "USA", description: "Paradise city. Gateway to the south, controlling the drug trade.", travelHoursBase: 5, imageUrl: "/images/cities/miami.png" },
      { name: "Los Angeles", nameAr: "لوس أنجلوس", country: "USA", description: "City of Angels. Where gang wars rage beneath the Hollywood lights.", travelHoursBase: 6, imageUrl: "/images/cities/los-angeles.png" },
      { name: "Beirut", nameAr: "بيروت", country: "Lebanon", description: "The Paris of the Middle East. A crossroads of power and intrigue.", travelHoursBase: 4, imageUrl: "/images/cities/beirut.png" },
    ]);
    console.log("Cities seeded");
  } else {
    console.log("Cities already exist, skipping");
  }

  const existingWeapons = await db.select().from(schema.weaponsTable);
  if (existingWeapons.length === 0) {
    await db.insert(schema.weaponsTable).values([
      { name: "Beretta M9", type: "pistol", attackPower: 15, price: 500, ammoType: "9mm", description: "A reliable semi-automatic pistol. The standard sidearm for any made man.", imageUrl: "/images/weapons/beretta-m9.png" },
      { name: "Desert Eagle", type: "pistol", attackPower: 25, price: 1200, ammoType: ".50 AE", description: "High-caliber hand cannon. Makes a statement in any room.", imageUrl: "/images/weapons/desert-eagle.png" },
      { name: "Remington 870", type: "shotgun", attackPower: 40, price: 1800, ammoType: "12-gauge", description: "Pump-action shotgun. Devastating at close range.", imageUrl: "/images/weapons/remington-870.png" },
      { name: "AK-47", type: "rifle", attackPower: 55, price: 3500, ammoType: "7.62mm", description: "The people's rifle. Reliable, powerful, and feared worldwide.", imageUrl: "/images/weapons/ak-47.png" },
      { name: "M16", type: "rifle", attackPower: 50, price: 3200, ammoType: "5.56mm", description: "Military-grade assault rifle. Precise and deadly.", imageUrl: "/images/weapons/m16.png" },
      { name: "MP5", type: "submachine_gun", attackPower: 35, price: 2500, ammoType: "9mm", description: "Compact submachine gun. Ideal for close-quarters operations.", imageUrl: "/images/weapons/mp5.png" },
      { name: "Dragunov SVD", type: "sniper", attackPower: 80, price: 8000, ammoType: "7.62mm", description: "Soviet sniper rifle. Eliminates targets from extreme range.", imageUrl: "/images/weapons/dragunov-svd.png" },
      { name: "RPG-7", type: "rpg", attackPower: 120, price: 15000, ammoType: "rocket", description: "Rocket-propelled grenade launcher. For when subtlety is not an option.", imageUrl: "/images/weapons/rpg-7.png" },
    ]);
    console.log("Weapons seeded");
  } else {
    console.log("Weapons already exist, skipping");
  }

  const existingAmmo = await db.select().from(schema.ammoTable);
  if (existingAmmo.length === 0) {
    await db.insert(schema.ammoTable).values([
      { name: "9mm Standard", type: "9mm", damageBonus: 5, price: 50, description: "Standard 9mm rounds. Compatible with most pistols and SMGs.", imageUrl: "/images/ammo/9mm-standard.png" },
      { name: ".50 AE Hollow Point", type: ".50 AE", damageBonus: 15, price: 200, description: "Devastating hollow point rounds for the Desert Eagle.", imageUrl: "/images/ammo/50-ae-hollow-point.png" },
      { name: "12-Gauge Buckshot", type: "12-gauge", damageBonus: 10, price: 80, description: "High-spread buckshot. Maximum damage in close quarters.", imageUrl: "/images/ammo/12-gauge-buckshot.png" },
      { name: "7.62mm AP", type: "7.62mm", damageBonus: 12, price: 120, description: "Armor-piercing 7.62mm rounds. Cuts through body armor.", imageUrl: "/images/ammo/7-62mm-ap.png" },
      { name: "5.56mm FMJ", type: "5.56mm", damageBonus: 8, price: 100, description: "Full metal jacket 5.56mm. Standard NATO specification.", imageUrl: "/images/ammo/5-56mm-fmj.png" },
      { name: "RPG Warhead", type: "rocket", damageBonus: 50, price: 2000, description: "High-explosive warhead for the RPG-7.", imageUrl: "/images/ammo/rpg-warhead.png" },
    ]);
    console.log("Ammo seeded");
  } else {
    console.log("Ammo already exist, skipping");
  }

  const existingArmor = await db.select().from(schema.armorItemsTable);
  if (existingArmor.length === 0) {
    await db.insert(schema.armorItemsTable).values([
      { name: "Bulletproof Vest", type: "bulletproof_vest", defenseBonus: 20, price: 2000, description: "Standard ballistic protection. Essential for any soldier.", imageUrl: "/images/armor/bulletproof-vest.png" },
      { name: "Armored Sedan", type: "armored_car", defenseBonus: 45, price: 25000, description: "Fully armored luxury sedan. Travel in style and safety.", imageUrl: "/images/armor/armored-sedan.png" },
      { name: "Armored SUV", type: "armored_car", defenseBonus: 60, price: 40000, description: "Massive armored SUV with run-flat tires. Built for war zones.", imageUrl: "/images/armor/armored-suv.png" },
      { name: "Combat Helicopter", type: "armored_helicopter", defenseBonus: 100, price: 150000, description: "Military-grade combat helicopter. Dominates from the sky.", imageUrl: "/images/armor/combat-helicopter.png" },
      { name: "Reinforced Bunker", type: "reinforced_bunker", defenseBonus: 200, price: 500000, description: "Underground reinforced command center. Near-impenetrable fortress.", imageUrl: "/images/armor/reinforced-bunker.png" },
    ]);
    console.log("Armor seeded");
  } else {
    console.log("Armor already exist, skipping");
  }

  const existingGuards = await db.select().from(schema.npcBodyguardsTable);
  if (existingGuards.length === 0) {
    await db.insert(schema.npcBodyguardsTable).values([
      { name: "Street Tough", tier: "basic", defensePower: 15, hirePrice: 1000, dailyCost: 100, description: "A local enforcer. Basic protection for everyday threats.", imageUrl: "/images/bodyguards/street-tough.png" },
      { name: "Ex-Cop", tier: "basic", defensePower: 20, hirePrice: 1500, dailyCost: 150, description: "A corrupt former officer. Knows police tactics inside out.", imageUrl: "/images/bodyguards/ex-cop.png" },
      { name: "Military Veteran", tier: "advanced", defensePower: 35, hirePrice: 5000, dailyCost: 400, description: "Combat-trained soldier. Handles high-pressure situations with ease.", imageUrl: "/images/bodyguards/military-veteran.png" },
      { name: "Special Forces", tier: "advanced", defensePower: 50, hirePrice: 8000, dailyCost: 600, description: "Elite tier-one operator. Highly trained and disciplined.", imageUrl: "/images/bodyguards/special-forces.png" },
      { name: "Ghost Operative", tier: "elite", defensePower: 75, hirePrice: 20000, dailyCost: 1500, description: "Unknown origin, lethal precision. Your last line of defense.", imageUrl: "/images/bodyguards/ghost-operative.png" },
      { name: "Cartel Enforcer", tier: "elite", defensePower: 90, hirePrice: 35000, dailyCost: 2500, description: "Battle-hardened cartel veteran. Has survived wars others didn't.", imageUrl: "/images/bodyguards/cartel-enforcer.png" },
    ]);
    console.log("NPC bodyguards seeded");
  } else {
    console.log("NPC bodyguards already exist, skipping");
  }

  const existingCrimes = await db.select().from(schema.crimeTypesTable);
  if (existingCrimes.length === 0) {
    await db.insert(schema.crimeTypesTable).values(CRIME_DATA);
    console.log("Crime types seeded");
  } else {
    for (const crime of CRIME_DATA) {
      const existing = existingCrimes.find(c => c.name === crime.name);
      if (existing) {
        await db.update(schema.crimeTypesTable).set({
          description: crime.description,
          minReward: crime.minReward,
          maxReward: crime.maxReward,
          xpReward: crime.xpReward,
          successRate: crime.successRate,
          prisonTimeHours: crime.prisonTimeHours,
          cooldownMinutes: crime.cooldownMinutes,
          requiredLevel: crime.requiredLevel,
        }).where(eq(schema.crimeTypesTable.id, existing.id));
      } else {
        await db.insert(schema.crimeTypesTable).values(crime);
      }
    }

    const crimeNamesToKeep = new Set(CRIME_DATA.map(c => c.name));
    for (const existing of existingCrimes) {
      if (!crimeNamesToKeep.has(existing.name)) {
        console.log(`Note: legacy crime "${existing.name}" left in DB (has history records)`);
      }
    }

    console.log("Crime types updated");
  }

  const existingPropertyTypes = await db.select().from(schema.propertyTypesTable);
  if (existingPropertyTypes.length === 0) {
    await db.insert(schema.propertyTypesTable).values([
      {
        nameEn: "Safe House", nameAr: "بيت آمن",
        descriptionEn: "A discreet hideout for low-profile operations. Your first step into the real estate game.",
        descriptionAr: "مخبأ سري للعمليات الهادئة. خطوتك الأولى في عالم العقارات.",
        price: 50000, baseIncomePerHour: 500, requiredLevel: 5, maxLevel: 4,
        icon: "home", perksEn: "Passive income, safe storage", perksAr: "دخل سلبي، تخزين آمن",
      },
      {
        nameEn: "Workshop", nameAr: "ورشة",
        descriptionEn: "A mechanical workshop used for vehicle prep and weapons maintenance.",
        descriptionAr: "ورشة ميكانيكية لتجهيز المركبات وصيانة الأسلحة.",
        price: 100000, baseIncomePerHour: 1000, requiredLevel: 8, maxLevel: 4,
        icon: "wrench", perksEn: "Steady income stream", perksAr: "دخل مستمر ومستقر",
      },
      {
        nameEn: "Nightclub", nameAr: "نادٍ ليلي",
        descriptionEn: "A popular nightclub that launders cash through legitimate entertainment revenue.",
        descriptionAr: "نادٍ ليلي يُدر دخلاً من الترفيه ويُغسّل الأموال.",
        price: 150000, baseIncomePerHour: 2000, requiredLevel: 10, maxLevel: 4,
        icon: "music", perksEn: "High foot traffic income", perksAr: "دخل مرتفع من حركة الزبائن",
      },
      {
        nameEn: "Drug Lab", nameAr: "مختبر",
        descriptionEn: "A hidden lab producing high-value products for the underground market.",
        descriptionAr: "مختبر سري يُنتج بضائع عالية القيمة للسوق السرية.",
        price: 300000, baseIncomePerHour: 4000, requiredLevel: 15, maxLevel: 4,
        icon: "flask-conical", perksEn: "High yield, high risk", perksAr: "عائد مرتفع ومخاطرة عالية",
      },
      {
        nameEn: "Ammo Factory", nameAr: "مصنع ذخيرة",
        descriptionEn: "Manufactures and supplies ammunition for the underworld's constant demands.",
        descriptionAr: "يُصنّع الذخيرة ويُوردها لتلبية طلبات العالم السفلي.",
        price: 350000, baseIncomePerHour: 3500, requiredLevel: 16, maxLevel: 4,
        icon: "zap", perksEn: "Reliable war economy income", perksAr: "دخل ثابت من اقتصاد الحرب",
      },
      {
        nameEn: "Weapons Warehouse", nameAr: "مستودع أسلحة",
        descriptionEn: "A fortified storage and distribution hub for illegal arms trafficking.",
        descriptionAr: "مستودع محصّن لتخزين وتوزيع الأسلحة غير المشروعة.",
        price: 400000, baseIncomePerHour: 4500, requiredLevel: 18, maxLevel: 4,
        icon: "shield", perksEn: "Arms trade profits", perksAr: "أرباح تجارة الأسلحة",
      },
      {
        nameEn: "Casino", nameAr: "كازينو",
        descriptionEn: "A glitzy casino that earns millions from gamblers day and night.",
        descriptionAr: "كازينو فاخر يجني الملايين من المقامرين ليل نهار.",
        price: 500000, baseIncomePerHour: 5000, requiredLevel: 20, maxLevel: 4,
        icon: "dice-6", perksEn: "Highest entertainment income", perksAr: "أعلى دخل ترفيهي",
      },
      {
        nameEn: "Hospital", nameAr: "مستشفى",
        descriptionEn: "A private hospital that generates income while providing a clean cover.",
        descriptionAr: "مستشفى خاص يُدر دخلاً ويوفر غطاءً نظيفاً.",
        price: 600000, baseIncomePerHour: 6000, requiredLevel: 25, maxLevel: 4,
        icon: "cross", perksEn: "Premium medical income", perksAr: "دخل طبي فاخر",
      },
      {
        nameEn: "Bank", nameAr: "بنك",
        descriptionEn: "A private bank that controls the flow of money across the underworld economy.",
        descriptionAr: "بنك خاص يتحكم في تدفق الأموال في الاقتصاد السري.",
        price: 1000000, baseIncomePerHour: 10000, requiredLevel: 30, maxLevel: 4,
        icon: "landmark", perksEn: "Dominates financial income", perksAr: "يهيمن على الدخل المالي",
      },
    ]);
    console.log("Property types seeded");
  } else {
    console.log("Property types already exist, skipping");
  }

  const existingRanks = await db.select().from(schema.playerRanksTable);
  if (existingRanks.length === 0) {
    await db.insert(schema.playerRanksTable).values([
      { rankNumber: 1,  nameEn: "Street Rat",        nameAr: "فأر الشوارع",      subtitleEn: "A nobody with nothing to lose",              subtitleAr: "لا شيء ولا أحد",               requiredLevel: 1,   requiredMoney: 0,          requiredXp: 0,        requiredKills: 0,   atkBonus: 0,   defBonus: 0,   maxProperties: 0,  color: "#6b7280", icon: "rat",     perksEn: "Starting rank",                              perksAr: "الرتبة الابتدائية" },
      { rankNumber: 2,  nameEn: "Alley Thug",         nameAr: "بلطجي الزقاق",     subtitleEn: "Muscle for hire, feared on the block",       subtitleAr: "عضلات للإيجار في الحي",         requiredLevel: 5,   requiredMoney: 100000,     requiredXp: 5000,     requiredKills: 0,   atkBonus: 5,   defBonus: 3,   maxProperties: 1,  color: "#78716c", icon: "fist",    perksEn: "+5 ATK, +3 DEF",                             perksAr: "+5 هجوم، +3 دفاع" },
      { rankNumber: 3,  nameEn: "Made Man",            nameAr: "رجل مصنوع",        subtitleEn: "Officially part of the family",              subtitleAr: "جزء رسمي من العائلة",           requiredLevel: 10,  requiredMoney: 500000,     requiredXp: 20000,    requiredKills: 0,   atkBonus: 10,  defBonus: 8,   maxProperties: 2,  color: "#a78bfa", icon: "star",    perksEn: "+10 ATK, +8 DEF",                            perksAr: "+10 هجوم، +8 دفاع" },
      { rankNumber: 4,  nameEn: "Enforcer",            nameAr: "المنفذ",           subtitleEn: "The muscle that makes problems disappear",   subtitleAr: "العضلة التي تُزيل المشاكل",     requiredLevel: 20,  requiredMoney: 2000000,    requiredXp: 75000,    requiredKills: 5,   atkBonus: 20,  defBonus: 15,  maxProperties: 3,  color: "#f59e0b", icon: "hammer",  perksEn: "+20 ATK, +15 DEF",                           perksAr: "+20 هجوم، +15 دفاع" },
      { rankNumber: 5,  nameEn: "Iron Fist",           nameAr: "القبضة الحديدية",  subtitleEn: "Ruthless and unstoppable",                   subtitleAr: "لا يرحم ولا يُوقف",            requiredLevel: 30,  requiredMoney: 5000000,    requiredXp: 200000,   requiredKills: 15,  atkBonus: 35,  defBonus: 25,  maxProperties: 4,  color: "#ef4444", icon: "shield",  perksEn: "+35 ATK, +25 DEF",                           perksAr: "+35 هجوم، +25 دفاع" },
      { rankNumber: 6,  nameEn: "Night Hawk",          nameAr: "صقر الليل",        subtitleEn: "Strikes from the shadows with deadly precision", subtitleAr: "يضرب من الظلام بدقة مميتة",  requiredLevel: 45,  requiredMoney: 12000000,   requiredXp: 500000,   requiredKills: 30,  atkBonus: 50,  defBonus: 40,  maxProperties: 5,  color: "#6366f1", icon: "eagle",   perksEn: "+50 ATK, +40 DEF",                           perksAr: "+50 هجوم، +40 دفاع" },
      { rankNumber: 7,  nameEn: "Dark Lord",           nameAr: "سيد الظلام",       subtitleEn: "Commands fear across the underworld",        subtitleAr: "يُسيطر بالرعب على العالم السفلي", requiredLevel: 60, requiredMoney: 25000000,  requiredXp: 1200000,  requiredKills: 60,  atkBonus: 70,  defBonus: 60,  maxProperties: 6,  color: "#8b5cf6", icon: "crown",   perksEn: "+70 ATK, +60 DEF",                           perksAr: "+70 هجوم، +60 دفاع" },
      { rankNumber: 8,  nameEn: "Crime King",          nameAr: "ملك الجريمة",      subtitleEn: "Sits atop the criminal hierarchy",           subtitleAr: "يجلس على قمة الهرم الإجرامي",  requiredLevel: 80,  requiredMoney: 50000000,   requiredXp: 2500000,  requiredKills: 100, atkBonus: 100, defBonus: 85,  maxProperties: 7,  color: "#dc2626", icon: "king",    perksEn: "+100 ATK, +85 DEF",                          perksAr: "+100 هجوم، +85 دفاع" },
      { rankNumber: 9,  nameEn: "The Pasha",           nameAr: "الباشا",           subtitleEn: "Commands entire districts with an iron will", subtitleAr: "يحكم مناطق كاملة بإرادة حديدية", requiredLevel: 100, requiredMoney: 100000000, requiredXp: 5000000,  requiredKills: 150, atkBonus: 140, defBonus: 120, maxProperties: 8,  color: "#f59e0b", icon: "pasha",   perksEn: "+140 ATK, +120 DEF",                         perksAr: "+140 هجوم، +120 دفاع" },
      { rankNumber: 10, nameEn: "The Grand Pasha",     nameAr: "الباشا الكبير",    subtitleEn: "Master of cities, broker of power",          subtitleAr: "سيد المدن ووسيط السلطة",        requiredLevel: 125, requiredMoney: 200000000,  requiredXp: 10000000, requiredKills: 200, atkBonus: 180, defBonus: 160, maxProperties: 9,  color: "#d97706", icon: "pasha2",  perksEn: "+180 ATK, +160 DEF",                         perksAr: "+180 هجوم، +160 دفاع" },
      { rankNumber: 11, nameEn: "National Pasha",      nameAr: "الباشا الوطني",    subtitleEn: "A living legend — the nation bows",          subtitleAr: "أسطورة حية — تنحني له الأمة",   requiredLevel: 150, requiredMoney: 500000000,  requiredXp: 20000000, requiredKills: 300, atkBonus: 250, defBonus: 220, maxProperties: 12, color: "#b45309", icon: "legend",  perksEn: "+250 ATK, +220 DEF",                         perksAr: "+250 هجوم، +220 دفاع" },
      { rankNumber: 12, nameEn: "Shadow Emperor",      nameAr: "إمبراطور الظلام",  subtitleEn: "The unseen hand that moves the world",       subtitleAr: "اليد الخفية التي تحرك العالم",  requiredLevel: 200, requiredMoney: 1000000000, requiredXp: 50000000, requiredKills: 500, atkBonus: 350, defBonus: 300, maxProperties: 15, color: "#7c3aed", icon: "emperor", perksEn: "+350 ATK, +300 DEF — Supreme dominance",     perksAr: "+350 هجوم، +300 دفاع — هيمنة مطلقة" },
    ]);
    console.log("Player ranks seeded");
  } else {
    console.log("Player ranks already exist, skipping");
  }

  const existingAdmin = await pool.query("SELECT id FROM admin_credentials LIMIT 1");
  if (existingAdmin.rows.length === 0) {
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "Admin@2025";
    if (!process.env.SUPER_ADMIN_PASSWORD) {
      console.warn("[WARN] SUPER_ADMIN_PASSWORD env var not set — using default dev password. Set this in production.");
    }
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      "INSERT INTO admin_credentials (username, password_hash) VALUES ($1, $2)",
      ["superadmin", hash],
    );
    console.log("Superadmin seeded — username: superadmin | change password via admin panel in production");
  } else {
    console.log("Admin credentials already exist, skipping");
  }

  console.log("Seeding complete!");
  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
