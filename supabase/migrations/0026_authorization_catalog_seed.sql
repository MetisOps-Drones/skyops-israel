-- Real regulatory categories for the special-operation authorization
-- catalog (פרק ד' — הרשאה להפעלה מיוחדת, תקנות הטיס כלי טיס בלתי מאויש),
-- as supplied by the product owner. Government fees for these aren't
-- published in a form we can cite reliably, so price_ils becomes nullable
-- rather than guessing a number next to a real legal category.

alter table special_authorization_types
  alter column price_ils drop not null;

insert into special_authorization_types (name, description, price_ils, active) values
  (
    'הסתייעות בתצפיתן',
    'הרשאה לפי תקנה 28 — הפעלת כטב"ם קטן בהסתייעות תצפיתן, כחריג לדרישות הרגילות.',
    null,
    true
  ),
  (
    'הטסה מכלי תחבורה בתנועה',
    'הרשאה לפי תקנה 25 — חריג לאיסור הטסת כטב"ם קטן מכלי טיס, כלי רחיפה, כלי רכב או כלי שיט בתנועה.',
    null,
    true
  ),
  (
    'הפעלה בדמדומים ובלילה',
    'הרשאה לפי תקנה 26(ג) — חריג לביצוע הפעלה בזמן דמדומים או בשעות הלילה.',
    null,
    true
  ),
  (
    'הפעלה ללא קשר עין ישיר (BVLOS)',
    'הרשאה לפי תקנה 27 — חריג לדרישת הפעלה תוך שמירה על קשר עין ישיר עם כלי הטיס.',
    null,
    true
  ),
  (
    'הטסה מעל אדם או תשתית',
    'הרשאה לפי תקנה 32 — חריג לאיסור הטסה מעל אדם או מעל תשתית.',
    null,
    true
  ),
  (
    'חריג למגבלות הכלליות',
    'הרשאה לפי תקנה 35 — חריג למגבלות הכלליות על הפעלת מערכת כטב"ם קטן.',
    null,
    true
  );
