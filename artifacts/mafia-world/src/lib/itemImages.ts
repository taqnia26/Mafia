export function getWeaponImage(name: string): string {
  const map: Record<string, string> = {
    "Beretta M9": "/images/weapons/beretta-m9.png",
    "Desert Eagle": "/images/weapons/desert-eagle.png",
    "Remington 870": "/images/weapons/remington-870.png",
    "AK-47": "/images/weapons/ak-47.png",
    "M16": "/images/weapons/m16.png",
    "MP5": "/images/weapons/mp5.png",
    "Dragunov SVD": "/images/weapons/dragunov-svd.png",
    "RPG-7": "/images/weapons/rpg-7.png",
  };
  return map[name] ?? "/images/weapons/ak-47.png";
}

export function getAmmoImage(name: string): string {
  const map: Record<string, string> = {
    "9mm Standard": "/images/ammo/9mm-standard.png",
    ".50 AE Hollow Point": "/images/ammo/50-ae-hollow-point.png",
    "12-Gauge Buckshot": "/images/ammo/12-gauge-buckshot.png",
    "7.62mm AP": "/images/ammo/7-62mm-ap.png",
    "5.56mm FMJ": "/images/ammo/5-56mm-fmj.png",
    "RPG Warhead": "/images/ammo/rpg-warhead.png",
  };
  return map[name] ?? "/images/ammo/9mm-standard.png";
}

export function getArmorImage(name: string): string {
  const map: Record<string, string> = {
    "Bulletproof Vest": "/images/armor/bulletproof-vest.png",
    "Armored Sedan": "/images/armor/armored-sedan.png",
    "Armored SUV": "/images/armor/armored-suv.png",
    "Combat Helicopter": "/images/armor/combat-helicopter.png",
    "Reinforced Bunker": "/images/armor/reinforced-bunker.png",
  };
  return map[name] ?? "/images/armor/bulletproof-vest.png";
}

export function getCityImage(name: string): string {
  const map: Record<string, string> = {
    "New York": "/images/cities/new-york.png",
    "Chicago": "/images/cities/chicago.png",
    "Las Vegas": "/images/cities/las-vegas.png",
    "Miami": "/images/cities/miami.png",
    "Los Angeles": "/images/cities/los-angeles.png",
    "Beirut": "/images/cities/beirut.png",
  };
  return map[name] ?? "/images/cities/new-york.png";
}

export function getBodyguardImage(name: string): string {
  const map: Record<string, string> = {
    "Street Tough": "/images/bodyguards/street-tough.png",
    "Ex-Cop": "/images/bodyguards/ex-cop.png",
    "Military Veteran": "/images/bodyguards/military-veteran.png",
    "Special Forces": "/images/bodyguards/special-forces.png",
    "Ghost Operative": "/images/bodyguards/ghost-operative.png",
    "Cartel Enforcer": "/images/bodyguards/cartel-enforcer.png",
  };
  return map[name] ?? "/images/bodyguards/street-tough.png";
}
