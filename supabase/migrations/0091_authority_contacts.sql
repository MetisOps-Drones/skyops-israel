-- An authority can have several numbers, each with its own purpose (Hatzor:
-- the tower line vs. the flight-coordination WhatsApp number). contacts is an
-- ordered list of {"label": "...", "phone": "..."}; the legacy phone /
-- backup_phone / whatsapp_phone columns stay (phone is still NOT NULL and the
-- app keeps them in sync with the list), so nothing that reads them breaks.
-- Idempotent: safe to re-run.
alter table coordination_authorities
  add column if not exists contacts jsonb not null default '[]'::jsonb;

-- Backfill every authority that has no list yet from its legacy columns.
update coordination_authorities a
set contacts = (
  select coalesce(jsonb_agg(c order by ord), '[]'::jsonb)
  from (
    select 1 as ord, jsonb_build_object('label', 'טלפון', 'phone', a.phone) as c
    union all
    select 2, jsonb_build_object('label', 'גיבוי', 'phone', a.backup_phone) where a.backup_phone is not null
    union all
    select 3, jsonb_build_object('label', 'וואטסאפ', 'phone', a.whatsapp_phone)
      where a.whatsapp_phone is not null and a.whatsapp_phone is distinct from a.phone
  ) x
)
where a.contacts = '[]'::jsonb;

-- Hatzor tower: the original line and the flight-coordination WhatsApp number.
update coordination_authorities
set phone = '073-3485024',
    whatsapp_phone = '0586726900',
    contacts = jsonb_build_array(
      jsonb_build_object('label', 'מגדל פיקוח', 'phone', '073-3485024'),
      jsonb_build_object('label', 'תיאום טיסות', 'phone', '058-672-6900')
    )
where name = 'מגדל פיקוח בסיס חצור';
