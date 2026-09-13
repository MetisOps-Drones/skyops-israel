-- Trend comparison (this period vs. the immediately preceding one of equal
-- length) needs a scalar total for the previous period too. Reusing
-- analytics_event_breakdown() just to sum its rows would ship the whole
-- per-event breakdown across the wire for a number nobody displays.
create or replace function analytics_total_event_count(target_org_id uuid, range_start timestamptz, range_end timestamptz)
returns int
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result int;
begin
  perform assert_analytics_access(target_org_id);

  select count(*)::int into result
  from app_events
  where created_at >= range_start
    and created_at < range_end
    and (target_org_id is null or org_id = target_org_id);

  return result;
end;
$$;
