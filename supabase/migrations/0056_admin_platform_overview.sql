-- Design-partner audit (control-center round): there is no screen anywhere
-- in the app that lists every organization on the platform, or shows their
-- basic activity — an admin who wants that today has to query the database
-- directly. This is the aggregation behind the new "כל הארגונים" admin tab.
-- (The matching "כל המשתמשים" tab needs no new function — profiles RLS
-- already grants dispatcher_admin unrestricted SELECT, so it's a plain
-- client-side query joined to organizations.)

create function admin_organizations_overview()
returns table (
  id uuid,
  name text,
  created_at timestamptz,
  member_count bigint,
  drone_count bigint,
  flight_request_count_30d bigint
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_dispatcher_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      o.id,
      o.name,
      o.created_at,
      coalesce(m.cnt, 0),
      coalesce(d.cnt, 0),
      coalesce(f.cnt, 0)
    from organizations o
    left join (
      select org_id, count(*) as cnt
      from organization_members
      where status = 'active'
      group by org_id
    ) m on m.org_id = o.id
    left join (
      select p.org_id, count(*) as cnt
      from drones dr
      join profiles p on p.id = dr.user_id
      where p.org_id is not null
      group by p.org_id
    ) d on d.org_id = o.id
    left join (
      select p.org_id, count(*) as cnt
      from flight_requests fr
      join profiles p on p.id = fr.user_id
      where p.org_id is not null and fr.created_at >= now() - interval '30 days'
      group by p.org_id
    ) f on f.org_id = o.id
    order by o.name;
end;
$$;
