-- /analytics used to fetch every raw app_events row in the range to the
-- browser and reduce it there (event counts, daily buckets, distinct actors)
-- — fine at test-data volumes, but it ships the entire audit log to the
-- client and re-does the same aggregation on every viewer's machine. Move
-- the three aggregations server-side. These are security definer (so they
-- can also serve the platform-wide dispatcher_admin view, which has no
-- single org_id to filter by and therefore no RLS row to key off), so each
-- checks the same authorization app_events' own RLS already encodes
-- (0020_app_events.sql) before touching any row.

create or replace function assert_analytics_access(target_org_id uuid)
returns void
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if target_org_id is null then
    if not is_dispatcher_admin() then
      raise exception 'Not authorized for platform-wide analytics';
    end if;
  else
    if not (is_org_fleet_manager(target_org_id) or is_dispatcher_admin()) then
      raise exception 'Not authorized for this organization''s analytics';
    end if;
  end if;
end;
$$;

create or replace function analytics_event_breakdown(target_org_id uuid, range_start timestamptz, range_end timestamptz)
returns table (event_name text, count int)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  perform assert_analytics_access(target_org_id);

  return query
    select ae.event_name, count(*)::int
    from app_events ae
    where ae.created_at >= range_start
      and ae.created_at < range_end
      and (target_org_id is null or ae.org_id = target_org_id)
    group by ae.event_name
    order by count(*) desc;
end;
$$;

create or replace function analytics_daily_activity(target_org_id uuid, range_start timestamptz, range_end timestamptz)
returns table (day date, count int)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  perform assert_analytics_access(target_org_id);

  return query
    select gs.day::date, coalesce(count(ae.created_at), 0)::int
    from generate_series(
      date_trunc('day', range_start),
      date_trunc('day', range_end - interval '1 second'),
      interval '1 day'
    ) as gs(day)
    left join app_events ae
      on date_trunc('day', ae.created_at) = gs.day
      and ae.created_at >= range_start
      and ae.created_at < range_end
      and (target_org_id is null or ae.org_id = target_org_id)
    group by gs.day
    order by gs.day;
end;
$$;

create or replace function analytics_active_user_count(target_org_id uuid, range_start timestamptz, range_end timestamptz)
returns int
language plpgsql
stable
security definer set search_path = public
as $$
declare
  result int;
begin
  perform assert_analytics_access(target_org_id);

  select count(distinct actor_id)::int into result
  from app_events
  where created_at >= range_start
    and created_at < range_end
    and actor_id is not null
    and (target_org_id is null or org_id = target_org_id);

  return result;
end;
$$;
