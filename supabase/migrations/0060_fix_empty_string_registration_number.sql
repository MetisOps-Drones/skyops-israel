-- The drone-registration form submits "" (not null) for a blank
-- registration_number field, so both default_drone_registration_expiry()
-- (0057) and the 0059 backfill treated "no registration entered" as "has a
-- registration", handing out a fake 4-year validity badge. Redefine the
-- trigger to treat '' the same as null, and undo the wrong backfill for any
-- drone that has no real registration number.
create or replace function default_drone_registration_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.registration_number is not null and new.registration_number <> '' and new.registration_expires_at is null then
    new.registration_expires_at := (timezone('utc', now())::date) + interval '4 years';
  end if;
  return new;
end;
$$;

update drones
set registration_expires_at = null
where (registration_number is null or registration_number = '')
  and registration_expires_at is not null;
