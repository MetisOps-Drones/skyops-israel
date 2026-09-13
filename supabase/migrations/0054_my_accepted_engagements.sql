-- The org-side "freelancers you've worked with" list needs the pilot's
-- name/avatar alongside each accepted contact_request row. A direct client
-- query with a `profiles!contact_requests_pilot_id_fkey(...)` embed hits RLS
-- on `profiles` (0049 deliberately dropped the broad "org members read any
-- profile" policy), so the embed silently fails for anyone but the row
-- owner/service role. Same shape of problem the marketplace browse RPCs
-- already solve — a small security-definer function instead of a raw embed.

create function my_accepted_engagements()
returns table (
  id uuid,
  pilot_id uuid,
  pilot_full_name text,
  pilot_avatar_url text,
  decided_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if current_org_id() is null then
    raise exception 'No active organization';
  end if;

  return query
    select distinct on (cr.pilot_id)
      cr.id,
      cr.pilot_id,
      p.full_name,
      p.avatar_url,
      cr.decided_at
    from contact_requests cr
    join profiles p on p.id = cr.pilot_id
    where cr.org_id = current_org_id()
      and cr.status = 'accepted'
    order by cr.pilot_id, cr.decided_at desc nulls last;
end;
$$;
