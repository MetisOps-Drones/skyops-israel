-- Once a booking is confirmed (0060 generates a short-lived association_code
-- at that point), either side may need a flight_request to be visible to
-- both the pilot and the hiring org — e.g. the org supplies the drone and
-- coordinates the area, so they need to see the request the pilot files for
-- it. flight_requests keeps its existing single-owner shape (user_id); this
-- only adds an optional link plus read access for the linked org. A real
-- calendar sync is future work — this is the v1 bridge.

alter table flight_requests
  add column if not exists booking_id uuid references marketplace_bookings (id) on delete set null;

create index flight_requests_booking_id_idx on flight_requests (booking_id) where booking_id is not null;

create policy "Org members read flight requests linked to their bookings"
  on flight_requests for select
  using (
    booking_id is not null
    and exists (select 1 from marketplace_bookings b where b.id = flight_requests.booking_id and b.org_id = current_org_id())
  );

create or replace function link_flight_request_to_booking(target_flight_request_id uuid, code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  b marketplace_bookings%rowtype;
  fr flight_requests%rowtype;
begin
  select * into b from marketplace_bookings
    where association_code = upper(trim(code))
      and status = 'confirmed'
      and association_expires_at > timezone('utc', now());
  if not found then
    raise exception 'קוד השיוך אינו תקין או שפג תוקפו';
  end if;

  if auth.uid() <> b.pilot_id and not is_same_org(b.org_id) and not is_dispatcher_admin() then
    raise exception 'אין הרשאה להשתמש בקוד שיוך זה';
  end if;

  select * into fr from flight_requests where id = target_flight_request_id;
  if not found then
    raise exception 'בקשת הטיסה לא נמצאה';
  end if;

  if fr.user_id <> auth.uid() and not is_same_org(b.org_id) and not is_dispatcher_admin() then
    raise exception 'אין הרשאה לשייך בקשת טיסה זו';
  end if;

  update flight_requests set booking_id = b.id where id = target_flight_request_id;
end;
$$;
