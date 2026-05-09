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

  "gangs.noGangs": { en: "No gangs found. Be the first to start one.", ar: "لا توجد عصابات. كن أول من يؤسس واحدة." },

  "blackmarket.browse": { en: "Browse Market", ar: "تصفح السوق" },
  "blackmarket.allItems": { en: "All Items", ar: "جميع العناصر" },
  "blackmarket.filter": { en: "Filter", ar: "تصفية" },
  "blackmarket.sellItem": { en: "Sell Item", ar: "بيع عنصر" },
  "blackmarket.itemId": { en: "Item ID", ar: "معرف العنصر" },
  "blackmarket.listItem": { en: "List Item", ar: "إدراج العنصر" },
  "blackmarket.activeListings": { en: "Active Listings", ar: "العروض النشطة" },
  "blackmarket.activeListingsDesc": { en: "Items you are currently selling", ar: "العناصر التي تبيعها حالياً" },
  "blackmarket.noActiveListings": { en: "No active listings.", ar: "لا توجد عروض نشطة." },
  "blackmarket.marketDry": { en: "The market is dry.", ar: "السوق فارغة." },
  "blackmarket.noItems": { en: "No items match your filter.", ar: "لا توجد عناصر تطابق الفلتر." },

  "crimes.available": { en: "Available Crimes", ar: "الجرائم المتاحة" },
  "crimes.busted": { en: "Busted!", ar: "تم القبض عليك!" },
  "crimes.failed": { en: "Crime Failed", ar: "فشلت الجريمة" },
  "crimes.cannotAttempt": { en: "Cannot attempt crime", ar: "لا يمكن محاولة الجريمة" },
  "crimes.rapSheet": { en: "Rap Sheet", ar: "سجل الجرائم" },
  "crimes.rapSheetDesc": { en: "Your recent criminal activity", ar: "نشاطك الإجرامي الأخير" },
  "crimes.caughtByCops": { en: "Busted by the cops", ar: "تم القبض عليك من الشرطة" },
  "crimes.failedEscaped": { en: "Failed attempt — escaped", ar: "محاولة فاشلة — هربت" },
  "crimes.cleanRecord": { en: "You have a clean record. Time to get to work.", ar: "سجلك نظيف. حان وقت العمل." },

  "cities.flightBooked": { en: "Flight Booked", ar: "تم حجز الرحلة" },
  "cities.cannotTravel": { en: "Cannot travel", ar: "لا يمكن السفر" },
  "cities.inTransit": { en: "In Transit", ar: "في الطريق" },
  "cities.inTransitDesc": { en: "You are currently traveling to your destination.", ar: "أنت حالياً في طريقك إلى وجهتك." },
  "cities.youAreHere": { en: "You are here", ar: "أنت هنا" },

  "prison.incarcerated": { en: "Incarcerated", ar: "مسجون" },
  "prison.unknownCrime": { en: "Unknown Crimes", ar: "جرائم مجهولة" },
  "prison.timeRemaining": { en: "Time Remaining", ar: "الوقت المتبقي" },
  "prison.lifeSentence": { en: "Life Sentence", ar: "حكم بالسجن المؤبد" },
  "prison.bribeOption": { en: "Bribe the Guards", ar: "رشوة الحراس" },
  "prison.bribeDesc": { en: "Pay to walk free immediately. Guaranteed success.", ar: "ادفع للخروج فوراً. ضمان النجاح." },
  "prison.bribeCost": { en: "Cost", ar: "التكلفة" },
  "prison.bribing": { en: "Bribing...", ar: "دفع الرشوة..." },
  "prison.bribeSuccess": { en: "Bribe Successful", ar: "نجحت الرشوة" },
  "prison.bribeFailed": { en: "Bribe Failed", ar: "فشلت الرشوة" },
  "prison.raidOption": { en: "Gang Raid", ar: "اقتحام العصابة" },
  "prison.raidDesc": { en: "Have your gang break you out. Requires gang members to initiate.", ar: "اطلب من عصابتك إخراجك. يتطلب أعضاء عصابة." },
  "prison.raidNote": { en: "40% success chance. Gang members must raid from the Players list.", ar: "فرصة نجاح 40٪. يجب على أعضاء العصابة الاقتحام من قائمة اللاعبين." },
  "prison.raidRequiresGang": { en: "Ask Gang to Raid", ar: "اطلب من العصابة الاقتحام" },
  "prison.freeDesc": { en: "You are not currently in prison. Keep your head down.", ar: "أنت لست في السجن حالياً. ابق بعيداً عن المشاكل." },

  "weapons.noWeapons": { en: "No weapons in your arsenal.", ar: "لا توجد أسلحة في ترسانتك." },
  "weapons.noAmmo": { en: "No ammo in your stash.", ar: "لا توجد ذخيرة في مخزونك." },

  "armor.purchased": { en: "Armor added to your inventory.", ar: "تم إضافة الدرع إلى مخزونك." },
  "armor.noArmor": { en: "No armor in your inventory.", ar: "لا توجد دروع في مخزونك." },

  "bodyguards.hired": { en: "Guard Hired", ar: "تم توظيف الحارس" },
  "bodyguards.hiredDesc": { en: "NPC bodyguard assigned to your detail.", ar: "تم تعيين حارس للحماية الشخصية." },
  "bodyguards.hireFailed": { en: "Hire Failed", ar: "فشل التوظيف" },
  "bodyguards.requestGuard": { en: "Request a Player Guard", ar: "طلب حارس من لاعب" },
  "bodyguards.requestGuardDesc": { en: "Ask another player to act as your personal bodyguard.", ar: "اطلب من لاعب آخر أن يكون حارسك الشخصي." },
  "bodyguards.targetPlayerId": { en: "Target Player ID", ar: "معرف اللاعب المستهدف" },
  "bodyguards.offerMoney": { en: "Offered Payment ($)", ar: "الدفعة المعروضة ($)" },
  "bodyguards.offerMoneyDesc": { en: "Optional payment to sweeten the deal.", ar: "دفعة اختيارية لتحسين العرض." },
  "bodyguards.sendRequest": { en: "Send Request", ar: "إرسال الطلب" },
  "bodyguards.requestSent": { en: "Request Sent", ar: "تم إرسال الطلب" },
  "bodyguards.requestSentDesc": { en: "Waiting for the player to respond.", ar: "في انتظار رد اللاعب." },
  "bodyguards.requestFailed": { en: "Request Failed", ar: "فشل الطلب" },
  "bodyguards.requestAccepted": { en: "Request Accepted", ar: "تم قبول الطلب" },
  "bodyguards.requestRejected": { en: "Request Rejected", ar: "تم رفض الطلب" },
  "bodyguards.incomingRequests": { en: "Incoming Requests", ar: "الطلبات الواردة" },
  "bodyguards.incomingRequestsDesc": { en: "Players asking you to guard them", ar: "لاعبون يطلبون منك حمايتهم" },
  "bodyguards.offering": { en: "Offering", ar: "يعرض" },
  "bodyguards.sentRequests": { en: "Sent Requests", ar: "الطلبات المرسلة" },
  "bodyguards.activeDetail": { en: "Guards currently protecting you", ar: "الحراس الذين يحمونك حالياً" },
  "bodyguards.noGuards": { en: "You have no active bodyguards.", ar: "ليس لديك حراس نشطون." },
  "bodyguards.playerGuard": { en: "Player", ar: "لاعب" },
  "bodyguards.perDay": { en: "day", ar: "يوم" },

  "attack.spy": { en: "Spy", ar: "تجسس" },
  "attack.spyFirst": { en: "Run a spy operation first to reveal the target's stats before attacking.", ar: "قم بعملية تجسس أولاً لكشف إحصائيات الهدف قبل الهجوم." },
  "attack.spyFirstHint": { en: "Spy on your target first, then configure your attack.", ar: "تجسس على هدفك أولاً، ثم قم بتكوين هجومك." },
  "attack.spyRequired": { en: "Spy is required before launching an attack.", ar: "التجسس مطلوب قبل شن الهجوم." },
  "attack.spySuccess": { en: "Spy Successful", ar: "نجاح التجسس" },
  "attack.spySuccessDesc": { en: "Intelligence gathered. You may now attack.", ar: "تم جمع المعلومات. يمكنك الآن الهجوم." },
  "attack.spyBlocked": { en: "Spy Blocked", ar: "تم حجب التجسس" },
  "attack.spyBlockedDesc": { en: "Target has Anti-Spy enabled. Cannot proceed.", ar: "الهدف لديه مكافحة تجسس مفعّلة. لا يمكن المتابعة." },
  "attack.spyFailed": { en: "Spy Failed", ar: "فشل التجسس" },
  "attack.intelligenceReport": { en: "Intelligence Report", ar: "تقرير الاستخبارات" },
  "attack.dispatchHit": { en: "Dispatch a Hit", ar: "إرسال ضربة" },
  "attack.dispatched": { en: "Attack Dispatched", ar: "تم إرسال الهجوم" },
  "attack.dispatchedEta": { en: "ETA", ar: "وقت الوصول" },
  "attack.dispatching": { en: "Dispatching...", ar: "جار الإرسال..." },
  "attack.failed": { en: "Attack Failed", ar: "فشل الهجوم" },
  "attack.targetPlayerId": { en: "Target Player ID", ar: "معرف اللاعب المستهدف" },
  "attack.selectWeaponPlaceholder": { en: "Select a weapon...", ar: "اختر سلاحاً..." },
  "attack.noWeapons": { en: "No weapons — visit the shop", ar: "لا أسلحة — زر المتجر" },
  "attack.myAttacksDesc": { en: "Hits you've put out on others", ar: "الضربات التي وجهتها للآخرين" },
  "attack.target": { en: "Target", ar: "الهدف" },
  "attack.rounds": { en: "rounds", ar: "طلقات" },
  "attack.arrivingIn": { en: "Arriving in", ar: "الوصول في" },
  "attack.dealt": { en: "Dealt", ar: "تعامل" },
  "attack.damage": { en: "damage", ar: "ضرر" },
  "attack.noOutgoing": { en: "No outgoing attacks.", ar: "لا توجد هجمات صادرة." },
  "attack.incomingDesc": { en: "Hits ordered on you", ar: "الضربات الموجهة إليك" },
  "attack.from": { en: "From", ar: "من" },
  "attack.impactIn": { en: "Impact in", ar: "الضربة في" },
  "attack.noIncoming": { en: "No incoming threats. Keep it that way.", ar: "لا توجد تهديدات واردة. حافظ على ذلك." },
  "attack.free": { en: "Free", ar: "حر" },

  "players.noPlayers": { en: "No players found.", ar: "لم يتم العثور على لاعبين." },

  "home.title": { en: "Mafia World", ar: "عالم المافيا" },
  "home.signIn": { en: "Sign In", ar: "تسجيل الدخول" },
  "home.playNow": { en: "Play Now", ar: "العب الآن" },
  "home.hero1": { en: "Rule the", ar: "حكم" },
  "home.hero2": { en: "Underworld", ar: "العالم السفلي" },
  "home.tagline": { en: "Build your criminal empire, hire bodyguards, smuggle weapons, and eliminate rival bosses in the most ruthless browser-based mafia strategy game.", ar: "ابنِ إمبراطوريتك الإجرامية، وظّف حراساً شخصيين، هرّب الأسلحة، واقضِ على زعماء المنافسين في أشد لعبة استراتيجية مافيا قسوةً على المتصفح." },
  "home.cta": { en: "Start Your Empire", ar: "ابدأ إمبراطوريتك" },
  "home.rights": { en: "All rights reserved.", ar: "جميع الحقوق محفوظة." },

  "admin.items": { en: "Item Catalog", ar: "كتالوج العناصر" },
  "admin.weapons": { en: "Weapons", ar: "الأسلحة" },
  "admin.ammo": { en: "Ammo", ar: "الذخيرة" },
  "admin.armor": { en: "Armor", ar: "الدروع" },
  "admin.cities": { en: "Cities", ar: "المدن" },
  "admin.addItem": { en: "Add Item", ar: "إضافة عنصر" },
  "admin.price": { en: "Price", ar: "السعر" },
  "admin.power": { en: "Power", ar: "القوة" },
  "admin.updateItem": { en: "Update Item", ar: "تحديث العنصر" },
  "admin.deleteItem": { en: "Delete Item", ar: "حذف العنصر" },
  "admin.travelHours": { en: "Travel Hours (Base)", ar: "ساعات السفر (الأساسية)" },
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
