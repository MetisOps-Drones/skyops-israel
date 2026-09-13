-- Module D: daily sweep that (1) recomputes every license's status against
-- today's date and (2) drops a `license_expiring` notification row for any
-- license that just crossed into the 30-day window. The Next.js cron route
-- handler (src/app/api/cron/check-license-expirations) reads notifications
-- created by this sweep and is responsible for actually dispatching SMS —
-- keeping the "who do we text" logic in the app layer, not the database.
create or replace function sweep_expiring_licenses()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  with recomputed as (
    update pilot_licenses
    set status = case
      when expires_at < current_date then 'expired'::license_status
      when expires_at <= current_date + interval '30 days' then 'expiring_soon'::license_status
      else 'active'::license_status
    end
    where status is distinct from (
      case
        when expires_at < current_date then 'expired'::license_status
        when expires_at <= current_date + interval '30 days' then 'expiring_soon'::license_status
        else 'active'::license_status
      end
    )
    returning id, user_id, license_type, expires_at, status
  ),
  newly_expiring as (
    insert into notifications (user_id, kind, title, body, metadata)
    select
      user_id,
      'license_expiring'::notification_kind,
      'הרישיון שלך עומד לפוג',
      format('רישיון %s פג תוקף בתאריך %s.', license_type, to_char(expires_at, 'DD/MM/YYYY')),
      jsonb_build_object('license_id', id, 'expires_at', expires_at, 'status', status)
    from recomputed
    where status in ('expiring_soon', 'expired')
    returning 1
  )
  select count(*) into affected_count from newly_expiring;

  return affected_count;
end;
$$;

-- Runs every day at 06:00 UTC (08:00/09:00 Israel time depending on DST).
select cron.schedule(
  'sweep-expiring-licenses-daily',
  '0 6 * * *',
  $$select sweep_expiring_licenses();$$
);
