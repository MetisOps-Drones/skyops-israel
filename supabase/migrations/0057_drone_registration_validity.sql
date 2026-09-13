-- CAAI drone-registration certificates are valid for 4 years (renewable for
-- further 4-year periods) — תקנות הטיס (הפעלת טיסן/כטב"ם קטן), התשפ"ד 2024:
-- "הרישום יהיה תקף למשך 4 שנים, ואולם בעלים רשום רשאי לבקש להאריך את תוקפה
-- של תעודת הרישום לתקופות נוספות של 4 שנים." Nothing in the app tracked this
-- at all before now — `drones.registration_number` was stored but its
-- validity window was never modeled, unlike pilot_licenses which already has
-- the identical active/expiring_soon/expired pattern this reuses.

alter table drones
  add column if not exists registration_expires_at date,
  add column if not exists registration_status license_status not null default 'active';

-- Mirrors pilot_licenses' recompute_license_status (0003) — keeps
-- registration_status consistent with registration_expires_at on every
-- write instead of duplicating the date math client-side.
create or replace function recompute_drone_registration_status()
returns trigger
language plpgsql
as $$
begin
  -- No registration number on file yet (e.g. a drone added before its CAAI
  -- registration exists) — nothing to expire.
  if new.registration_expires_at is null then
    new.registration_status := 'active';
    return new;
  end if;

  if new.registration_expires_at < current_date then
    new.registration_status := 'expired';
  elsif new.registration_expires_at <= current_date + interval '30 days' then
    new.registration_status := 'expiring_soon';
  else
    new.registration_status := 'active';
  end if;
  return new;
end;
$$;

create trigger drones_recompute_registration_status
  before insert or update of registration_expires_at on drones
  for each row execute function recompute_drone_registration_status();

-- A drone registered with a registration_number but no explicit expiry
-- defaults to the full 4-year validity period from today, matching the law's
-- default term — the owner can still override it (e.g. entering the real
-- date off their CAAI certificate).
create or replace function default_drone_registration_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.registration_number is not null and new.registration_expires_at is null then
    new.registration_expires_at := (timezone('utc', now())::date) + interval '4 years';
  end if;
  return new;
end;
$$;

create trigger drones_default_registration_expiry
  before insert on drones
  for each row execute function default_drone_registration_expiry();
