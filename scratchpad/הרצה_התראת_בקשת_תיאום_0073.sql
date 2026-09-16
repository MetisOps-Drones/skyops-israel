-- Nothing previously notified a dispatcher_admin that a new coordination
-- request had arrived — the only signal was the 30s poll on
-- usePendingCoordinationRequests, and only while /ops happened to be open.
-- Same pattern as notify_and_log_booking_message's admin loop (0070): one
-- notification row per dispatcher_admin, so it shows up in their existing
-- bell (useNotifications) regardless of what page they're on.

alter type notification_kind add value 'coordination_requested';
alter type notification_kind add value 'flight_request_rejected';

create or replace function notify_dispatchers_of_new_coordination_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requester_name text;
  admin_id uuid;
begin
  if new.status <> 'pending_dispatcher' then
    return new;
  end if;

  select full_name into requester_name from profiles where id = new.user_id;

  for admin_id in select id from profiles where role = 'dispatcher_admin' loop
    insert into notifications (user_id, kind, title, body, metadata)
    values (
      admin_id,
      'coordination_requested',
      'בקשת תיאום חדשה',
      coalesce(requester_name, 'מטיס/ה') || ' שלח/ה בקשת תיאום חדשה הממתינה לטיפול.',
      jsonb_build_object('flight_request_id', new.id)
    );
  end loop;

  return new;
end;
$$;

create trigger flight_requests_notify_dispatchers
  after insert on flight_requests
  for each row execute function notify_dispatchers_of_new_coordination_request();
