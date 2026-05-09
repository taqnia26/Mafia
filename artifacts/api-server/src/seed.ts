import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("Seeding database...");

  const existingCities = await db.select().from(schema.citiesTable);
  if (existingCities.length === 0) {
    await db.insert(schema.citiesTable).values([
      { name: "New York", nameAr: "نيويورك", country: "USA", description: "The city that never sleeps. Home to the most powerful crime families.", travelHoursBase: 4 },
      { name: "Chicago", nameAr: "شيكاغو", country: "USA", description: "The Windy City. Known for bootleggers and organized crime since Prohibition.", travelHoursBase: 5 },
      { name: "Las Vegas", nameAr: "لاس فيغاس", country: "USA", description: "The city of sin. Where fortunes are made and lost overnight.", travelHoursBase: 6 },
      { name: "Miami", nameAr: "ميامي", country: "USA", description: "Paradise city. Gateway to the south, controlling the drug trade.", travelHoursBase: 5 },
      { name: "Los Angeles", nameAr: "لوس أنجلوس", country: "USA", description: "City of Angels. Where gang wars rage beneath the Hollywood lights.", travelHoursBase: 6 },
      { name: "Beirut", nameAr: "بيروت", country: "Lebanon", description: "The Paris of the Middle East. A crossroads of power and intrigue.", travelHoursBase: 4 },
    ]);
    console.log("Cities seeded");
  } else {
    console.log("Cities already exist, skipping");
  }

  const existingWeapons = await db.select().from(schema.weaponsTable);
  if (existingWeapons.length === 0) {
    await db.insert(schema.weaponsTable).values([
      { name: "Beretta M9", type: "pistol", attackPower: 15, price: 500, ammoType: "9mm", description: "A reliable semi-automatic pistol. The standard sidearm for any made man." },
      { name: "Desert Eagle", type: "pistol", attackPower: 25, price: 1200, ammoType: ".50 AE", description: "High-caliber hand cannon. Makes a statement in any room." },
      { name: "Remington 870", type: "shotgun", attackPower: 40, price: 1800, ammoType: "12-gauge", description: "Pump-action shotgun. Devastating at close range." },
      { name: "AK-47", type: "rifle", attackPower: 55, price: 3500, ammoType: "7.62mm", description: "The people's rifle. Reliable, powerful, and feared worldwide." },
      { name: "M16", type: "rifle", attackPower: 50, price: 3200, ammoType: "5.56mm", description: "Military-grade assault rifle. Precise and deadly." },
      { name: "MP5", type: "submachine_gun", attackPower: 35, price: 2500, ammoType: "9mm", description: "Compact submachine gun. Ideal for close-quarters operations." },
      { name: "Dragunov SVD", type: "sniper", attackPower: 80, price: 8000, ammoType: "7.62mm", description: "Soviet sniper rifle. Eliminates targets from extreme range." },
      { name: "RPG-7", type: "rpg", attackPower: 120, price: 15000, ammoType: "rocket", description: "Rocket-propelled grenade launcher. For when subtlety is not an option." },
    ]);
    console.log("Weapons seeded");
  } else {
    console.log("Weapons already exist, skipping");
  }

  const existingAmmo = await db.select().from(schema.ammoTable);
  if (existingAmmo.length === 0) {
    await db.insert(schema.ammoTable).values([
      { name: "9mm Standard", type: "9mm", damageBonus: 5, price: 50, description: "Standard 9mm rounds. Compatible with most pistols and SMGs." },
      { name: ".50 AE Hollow Point", type: ".50 AE", damageBonus: 15, price: 200, description: "Devastating hollow point rounds for the Desert Eagle." },
      { name: "12-Gauge Buckshot", type: "12-gauge", damageBonus: 10, price: 80, description: "High-spread buckshot. Maximum damage in close quarters." },
      { name: "7.62mm AP", type: "7.62mm", damageBonus: 12, price: 120, description: "Armor-piercing 7.62mm rounds. Cuts through body armor." },
      { name: "5.56mm FMJ", type: "5.56mm", damageBonus: 8, price: 100, description: "Full metal jacket 5.56mm. Standard NATO specification." },
      { name: "RPG Warhead", type: "rocket", damageBonus: 50, price: 2000, description: "High-explosive warhead for the RPG-7." },
    ]);
    console.log("Ammo seeded");
  } else {
    console.log("Ammo already exist, skipping");
  }

  const existingArmor = await db.select().from(schema.armorItemsTable);
  if (existingArmor.length === 0) {
    await db.insert(schema.armorItemsTable).values([
      { name: "Bulletproof Vest", type: "bulletproof_vest", defenseBonus: 20, price: 2000, description: "Standard ballistic protection. Essential for any soldier." },
      { name: "Armored Sedan", type: "armored_car", defenseBonus: 45, price: 25000, description: "Fully armored luxury sedan. Travel in style and safety." },
      { name: "Armored SUV", type: "armored_car", defenseBonus: 60, price: 40000, description: "Massive armored SUV with run-flat tires. Built for war zones." },
      { name: "Combat Helicopter", type: "armored_helicopter", defenseBonus: 100, price: 150000, description: "Military-grade combat helicopter. Dominates from the sky." },
      { name: "Reinforced Bunker", type: "reinforced_bunker", defenseBonus: 200, price: 500000, description: "Underground reinforced command center. Near-impenetrable fortress." },
    ]);
    console.log("Armor seeded");
  } else {
    console.log("Armor already exist, skipping");
  }

  const existingGuards = await db.select().from(schema.npcBodyguardsTable);
  if (existingGuards.length === 0) {
    await db.insert(schema.npcBodyguardsTable).values([
      { name: "Street Tough", tier: "basic", defensePower: 15, hirePrice: 1000, dailyCost: 100, description: "A local enforcer. Basic protection for everyday threats." },
      { name: "Ex-Cop", tier: "basic", defensePower: 20, hirePrice: 1500, dailyCost: 150, description: "A corrupt former officer. Knows police tactics inside out." },
      { name: "Military Veteran", tier: "advanced", defensePower: 35, hirePrice: 5000, dailyCost: 400, description: "Combat-trained soldier. Handles high-pressure situations with ease." },
      { name: "Special Forces", tier: "advanced", defensePower: 50, hirePrice: 8000, dailyCost: 600, description: "Elite tier-one operator. Highly trained and disciplined." },
      { name: "Ghost Operative", tier: "elite", defensePower: 75, hirePrice: 20000, dailyCost: 1500, description: "Unknown origin, lethal precision. Your last line of defense." },
      { name: "Cartel Enforcer", tier: "elite", defensePower: 90, hirePrice: 35000, dailyCost: 2500, description: "Battle-hardened cartel veteran. Has survived wars others didn't." },
    ]);
    console.log("NPC bodyguards seeded");
  } else {
    console.log("NPC bodyguards already exist, skipping");
  }

  const existingCrimes = await db.select().from(schema.crimeTypesTable);
  if (existingCrimes.length === 0) {
    await db.insert(schema.crimeTypesTable).values([
      { name: "Pickpocket", description: "Lift wallets from unsuspecting tourists. Low risk, low reward.", minReward: 100, maxReward: 500, xpReward: 10, successRate: 0.85, prisonTimeHours: 1, cooldownMinutes: 15, requiredLevel: 1 },
      { name: "Car Theft", description: "Steal a vehicle and sell it for parts. Quick cash if you can hotwire it.", minReward: 500, maxReward: 2000, xpReward: 25, successRate: 0.75, prisonTimeHours: 3, cooldownMinutes: 30, requiredLevel: 1 },
      { name: "Liquor Store Robbery", description: "Rob the register at gunpoint. Requires nerve and speed.", minReward: 1000, maxReward: 4000, xpReward: 50, successRate: 0.65, prisonTimeHours: 6, cooldownMinutes: 60, requiredLevel: 2 },
      { name: "Bank Heist", description: "Plan and execute a full bank robbery. High risk, massive reward.", minReward: 5000, maxReward: 20000, xpReward: 150, successRate: 0.45, prisonTimeHours: 12, cooldownMinutes: 120, requiredLevel: 5 },
      { name: "Arms Smuggling", description: "Move illegal weapons across state lines. Lucrative underworld trade.", minReward: 8000, maxReward: 30000, xpReward: 200, successRate: 0.40, prisonTimeHours: 18, cooldownMinutes: 180, requiredLevel: 8 },
      { name: "Assassination Contract", description: "A contract killing for a rival family. The highest paying crime in the underworld.", minReward: 20000, maxReward: 80000, xpReward: 400, successRate: 0.30, prisonTimeHours: 24, cooldownMinutes: 360, requiredLevel: 15 },
    ]);
    console.log("Crime types seeded");
  } else {
    console.log("Crime types already exist, skipping");
  }

  console.log("Seeding complete!");
  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
