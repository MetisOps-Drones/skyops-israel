-- Completes the special-operation authorization catalog against the
-- official list in תקנות הטיס (הפעלת כטב"ם קטן) התשפ"ד 2024, פרק
-- "הרשאה להפעלה מיוחדת": 0026 seeded regulations 25/26(ג)/27/28/32/35 but
-- was missing 29 and 30. (2(ב), the bare licensing requirement, is
-- intentionally left out of the purchasable catalog — "authorization to
-- operate unlicensed" isn't a product to sell.)

insert into special_authorization_types (name, description, price_ils, regulation_number, active) values
  (
    'הפעלת מספר כטב"מים בו-זמנית',
    'הרשאה לפי תקנה 29 — חריג לאיסור על הפעלת יותר מכטב"ם קטן אחד באותו זמן בידי אותו אדם.',
    null,
    'תקנה 29',
    true
  ),
  (
    'הפעלה בחקלאות עם חומר מסוכן',
    'הרשאה לפי תקנה 30 (ותקנה 18(ג)) — הפעלת כלי טיס בחקלאות, לרבות ריסוס חומר מסוכן, מעבר לתנאים הרגילים.',
    null,
    'תקנה 30',
    true
  );
