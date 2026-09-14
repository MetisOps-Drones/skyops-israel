-- In-app chat for a booking, opened once the pilot accepts the invitation
-- (status leaves 'invited') so contact details never need to be exchanged
-- outside the platform. Dispatcher admins get read access ("בקרה ראשית")
-- for oversight — same reasoning as the pilot_reviews/contact_requests admin
-- policies already in 0049 — everyone else only sees threads they're in.

create table booking_messages (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references marketplace_bookings (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now())
);

create index booking_messages_booking_id_idx on booking_messages (booking_id, created_at);

alter table booking_messages enable row level security;

create policy "Participants and admins read booking messages"
  on booking_messages for select
  using (
    is_dispatcher_admin()
    or exists (
      select 1 from marketplace_bookings b
      where b.id = booking_messages.booking_id
        and (b.pilot_id = auth.uid() or b.org_id = current_org_id())
    )
  );

create policy "Participants send booking messages once negotiation is open"
  on booking_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from marketplace_bookings b
      where b.id = booking_messages.booking_id
        and b.status not in ('invited', 'declined')
        and (b.pilot_id = auth.uid() or b.org_id = current_org_id())
    )
  );

create or replace function notify_and_log_booking_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  b marketplace_bookings%rowtype;
  sender_name text;
  target_user uuid;
begin
  select * into b from marketplace_bookings where id = new.booking_id;

  insert into app_events (actor_id, org_id, event_name, entity_type, entity_id, metadata)
  values (new.sender_id, b.org_id, 'booking.message_sent', 'marketplace_booking', b.id, jsonb_build_object('message_id', new.id));

  select full_name into sender_name from profiles where id = new.sender_id;
  target_user := case when new.sender_id = b.pilot_id then b.created_by else b.pilot_id end;

  insert into notifications (user_id, kind, title, body, metadata)
  values (
    target_user,
    'booking_message_received',
    'הודעה חדשה בצ׳אט העבודה',
    coalesce(sender_name, 'צד שני') || ': ' || left(new.body, 80),
    jsonb_build_object('booking_id', b.id, 'message_id', new.id)
  );

  return new;
end;
$$;

create trigger booking_messages_notify_and_log
  after insert on booking_messages
  for each row execute function notify_and_log_booking_message();
