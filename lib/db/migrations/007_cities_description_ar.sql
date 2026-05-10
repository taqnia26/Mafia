-- Add Arabic description to cities for proper bilingual support
ALTER TABLE cities ADD COLUMN IF NOT EXISTS description_ar TEXT NOT NULL DEFAULT '';

-- Seed Arabic descriptions for existing cities (idempotent)
UPDATE cities SET description_ar = 'المدينة التي لا تنام. موطن لأقوى عائلات الجريمة المنظمة.' WHERE name = 'New York' AND (description_ar IS NULL OR description_ar = '');
UPDATE cities SET description_ar = 'مدينة الرياح. اشتهرت بمهربي الخمور والجريمة المنظمة منذ عصر الحظر.' WHERE name = 'Chicago' AND (description_ar IS NULL OR description_ar = '');
UPDATE cities SET description_ar = 'مدينة الخطيئة. حيث تُصنع الثروات وتُفقد بين عشية وضحاها.' WHERE name = 'Las Vegas' AND (description_ar IS NULL OR description_ar = '');
UPDATE cities SET description_ar = 'مدينة الفردوس. بوابة الجنوب التي تتحكم في تجارة المخدرات.' WHERE name = 'Miami' AND (description_ar IS NULL OR description_ar = '');
UPDATE cities SET description_ar = 'مدينة الملائكة. حيث تشتعل حروب العصابات تحت أضواء هوليوود.' WHERE name = 'Los Angeles' AND (description_ar IS NULL OR description_ar = '');
UPDATE cities SET description_ar = 'باريس الشرق الأوسط. ملتقى السلطة والمؤامرات.' WHERE name = 'Beirut' AND (description_ar IS NULL OR description_ar = '');
