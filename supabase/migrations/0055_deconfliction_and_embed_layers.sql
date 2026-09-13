-- Design-partner audit (control-center round): the spatial check on a new
-- flight request only ever compares it against static airspace zones — never
-- against OTHER pilots' active requests. Two unrelated orgs can both get a
-- bubble approved over the same field at the same hour with nobody the
-- wiser. This gives the dispatcher/admin a way to see that before approving.
--
-- Also extends the existing partner-API-layer model (0034) with three new
-- layers: a live "which bubbles are active right now" feed (the CAAI-facing
-- idea from the review), and two embeddable-widget layers (map, marketplace)
-- for partners who want the actual UI, not just raw data.

alter type api_layer add value 'live_ops';
alter type api_layer add value 'map_embed';
alter type api_layer add value 'marketplace_embed';

-- Every other request whose time window and footprint overlap this one's,
-- excluding the same pilot's own other requests. `for all` in 0011 already
-- gives dispatcher_admin full access to flight_requests, so this only needs
-- an explicit admin check because it also joins profiles/organizations for
-- context that a plain RLS-scoped client query couldn't assemble as cleanly.
create function overlapping_flight_requests(target_id uuid)
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  org_id uuid,
  org_name text,
  status flight_request_status,
  start_time timestamptz,
  end_time timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  target record;
begin
  if not is_dispatcher_admin() then
    raise exception 'Not authorized';
  end if;

  select
    fr.user_id,
    fr.start_time,
    fr.end_time,
    coalesce(fr.polygon, st_buffer(fr.center_point::geography, coalesce(fr.radius_meters, 100))::geometry) as footprint
  into target
  from flight_requests fr
  where fr.id = target_id;

  if target is null then
    return;
  end if;

  return query
    select
      fr.id,
      fr.user_id,
      p.full_name,
      p.org_id,
      o.name,
      fr.status,
      fr.start_time,
      fr.end_time
    from flight_requests fr
    join profiles p on p.id = fr.user_id
    left join organizations o on o.id = p.org_id
    where fr.id <> target_id
      and fr.user_id <> target.user_id
      and fr.status in ('pending_dispatcher', 'submitted_to_iaf', 'notam_published', 'auto_cleared')
      and fr.start_time < target.end_time
      and fr.end_time > target.start_time
      and st_intersects(
        coalesce(fr.polygon, st_buffer(fr.center_point::geography, coalesce(fr.radius_meters, 100))::geometry),
        target.footprint
      );
end;
$$;
