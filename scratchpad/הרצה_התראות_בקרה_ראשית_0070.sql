-- notify_and_log_booking_message() (0063) only notified the other
-- participant, not "בקרה ראשית" — dispatcher admins already have read
-- access to every booking thread (0063's select policy) but had no way to
-- know a new message existed without opening each booking manually. Give
-- every dispatcher_admin the same notification row the other participant
-- gets, so it shows up in their existing notification bell.

create or replace function notify_and_log_booking_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  b marketplace_bookings%rowtype;
  sender_name text;
  target_user uuid;
  admin_id uuid;
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

  for admin_id in select id from profiles where role = 'dispatcher_admin' and id <> new.sender_id loop
    insert into notifications (user_id, kind, title, body, metadata)
    values (
      admin_id,
      'booking_message_received',
      'הודעה חדשה בצ׳אט עבודה (בקרה ראשית)',
      coalesce(sender_name, 'צד שני') || ' — ' || coalesce(b.title, 'עבודה') || ': ' || left(new.body, 80),
      jsonb_build_object('booking_id', b.id, 'message_id', new.id)
    );
  end loop;

  return new;
end;
$$;
