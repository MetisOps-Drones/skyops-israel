-- Single-booking read for the chat screen. my_marketplace_bookings() (0060)
-- only returns bookings the caller is a participant in; the admin
-- monitoring screen ("בקרה ראשית") needs to open any one booking's chat by
-- id, so this is the same shape gated by participant-or-admin instead.

create function get_marketplace_booking(target_booking_id uuid)
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  pilot_id uuid,
  pilot_full_name text,
  pilot_avatar_url text,
  created_by uuid,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  status booking_status,
  association_code text,
  association_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  return query
    select
      b.id, b.org_id, o.name, b.pilot_id, p.full_name, p.avatar_url, b.created_by,
      b.title, b.description, b.start_time, b.end_time, b.status,
      case when b.pilot_id = auth.uid() or is_same_org(b.org_id) then b.association_code else null end,
      b.association_expires_at, b.created_at
    from marketplace_bookings b
    join organizations o on o.id = b.org_id
    join profiles p on p.id = b.pilot_id
    where b.id = target_booking_id
      and (b.pilot_id = auth.uid() or b.org_id = current_org_id() or is_dispatcher_admin());
end;
$$;
