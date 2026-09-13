-- Phase 1 remainder:
--   C-02 reject a flight request server-side if the pilot's license doesn't
--        cover the drone's weight class or the request type, before it ever
--        reaches a dispatcher.
--   C-04 same gate, extended to require a currently-valid insurance
--        certificate document for commercial-grade requests.
--   F-02 a share_token on flight_logs so a client-facing report link can be
--        generated without exposing the rest of the app.
--   F-04 cost/revenue fields so profitability can be tracked per job.

-- ---------------------------------------------------------------------------
-- C-02 + C-04: license/insurance gate on flight_requests
-- ---------------------------------------------------------------------------

create or replace function validate_flight_request_requirements()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  drone_mtow integer;
  matching_license license_type;
  has_valid_insurance boolean;
begin
  select mtow_grams into drone_mtow from drones where id = new.drone_id;
  if drone_mtow is null then
    raise exception 'לא נמצא כלי טיס לבקשה';
  end if;

  -- Pick the pilot's best non-expired license that covers this airframe's
  -- weight, and (for NOTAM-bubble requests, which imply commercial-grade
  -- coordination) is not a hobby license.
  select license_type into matching_license
  from pilot_licenses
  where user_id = new.user_id
    and status <> 'expired'
    and (
      (license_type = 'hobby' and drone_mtow <= 5000)
      or (license_type = 'commercial_25kg' and drone_mtow <= 25000)
      or (license_type = 'heavy_2000kg' and drone_mtow <= 2000000)
    )
    and (new.request_type <> 'manual_notam_bubble' or license_type <> 'hobby')
  order by
    case license_type when 'heavy_2000kg' then 3 when 'commercial_25kg' then 2 else 1 end desc
  limit 1;

  if matching_license is null then
    raise exception 'אין לטייס רישיון בתוקף המתאים למשקל כלי הטיס (% גרם) או לסוג הבקשה', drone_mtow;
  end if;

  -- Commercial-grade requests (anything beyond a hobby-class basic flight)
  -- require a currently-valid insurance certificate on file.
  if matching_license <> 'hobby' then
    select exists (
      select 1 from documents
      where user_id = new.user_id
        and kind = 'insurance_certificate'
        and ocr_extracted_expires_at is not null
        and ocr_extracted_expires_at >= current_date
    ) into has_valid_insurance;

    if not has_valid_insurance then
      raise exception 'נדרש אישור ביטוח בתוקף לפני שליחת בקשת טיסה מסחרית';
    end if;
  end if;

  return new;
end;
$$;

create trigger flight_requests_validate_requirements
  before insert on flight_requests
  for each row execute function validate_flight_request_requirements();

-- ---------------------------------------------------------------------------
-- F-02: client share link for a flight log
-- ---------------------------------------------------------------------------

alter table flight_logs
  add column share_token text unique;

create index flight_logs_share_token_idx on flight_logs (share_token) where share_token is not null;

-- ---------------------------------------------------------------------------
-- F-04: job profitability
-- ---------------------------------------------------------------------------

alter table flight_logs
  add column client_name text,
  add column price numeric(10, 2),
  add column cost numeric(10, 2);
