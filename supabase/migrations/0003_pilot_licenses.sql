create table pilot_licenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  license_type license_type not null,
  license_number text not null,
  document_url text,
  issued_at date,
  expires_at date not null,
  status license_status not null default 'active',
  ocr_extracted_at timestamptz,
  ocr_raw_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, license_type, license_number)
);

create index pilot_licenses_user_id_idx on pilot_licenses (user_id);
create index pilot_licenses_expires_at_idx on pilot_licenses (expires_at);
create index pilot_licenses_status_idx on pilot_licenses (status);

create trigger pilot_licenses_set_updated_at
  before update on pilot_licenses
  for each row execute function set_updated_at();

-- Keeps `status` consistent with `expires_at` on every write, so the app
-- never has to duplicate this date math in multiple places.
create or replace function recompute_license_status()
returns trigger
language plpgsql
as $$
begin
  if new.expires_at < current_date then
    new.status := 'expired';
  elsif new.expires_at <= current_date + interval '30 days' then
    new.status := 'expiring_soon';
  else
    new.status := 'active';
  end if;
  return new;
end;
$$;

create trigger pilot_licenses_recompute_status
  before insert or update of expires_at on pilot_licenses
  for each row execute function recompute_license_status();
