-- A coordination authority's landline (phone) and the number the coordinator
-- actually reaches them on over WhatsApp are not always the same thing --
-- Hatzor's tower line is 073-3485024, but coordination there runs over a
-- WhatsApp number. whatsapp_phone is shown to the coordinator as a link that
-- opens the chat directly (see CoordinationPanel). Admin-only like the rest
-- of coordination_authorities (RLS from 0072) -- never reaches a pilot/org.
-- Idempotent: safe to re-run.
alter table coordination_authorities
  add column if not exists whatsapp_phone text;

comment on column coordination_authorities.whatsapp_phone is
  'Local Israeli format (05X-XXXXXXX). Used to build a wa.me chat link for the coordinator.';

update coordination_authorities
set whatsapp_phone = '0586726900'
where name = 'מגדל פיקוח בסיס חצור';
