-- 0057 only defaults registration_expires_at on INSERT, so every drone that
-- already existed before that migration ran was left with a null expiry —
-- DroneRegistrationBadge renders nothing for a null expiresAt, silently
-- hiding the whole feature for all pre-existing fleets. Backfill the same
-- 4-year-from-today default for rows that have a registration_number but no
-- expiry yet.
update drones
set registration_expires_at = (timezone('utc', now())::date) + interval '4 years'
where registration_number is not null
  and registration_expires_at is null;
