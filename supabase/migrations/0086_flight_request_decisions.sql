-- NOTAM lifecycle + a real decision audit trail (second of the 3 מוקד
-- תיאום improvements Ohad asked for -- "from design to legal control").
--
-- Today a flight_request has exactly one "last touched" snapshot --
-- reviewed_by/reviewed_at/dispatcher_notes/notam_code -- each overwritten
-- in place by whichever action ran last. That means: no way to see who
-- did what and when across multiple actions on the same request (e.g. a
-- request that was rejected, reconsidered, then published), and --
-- concretely worse -- a published NOTAM is a dead end: if a flight gets
-- cancelled or a dispatcher made a mistake, there is no in-system way to
-- retract it. This table is an append-only log of every dispatcher
-- decision; cancel_notam (see actions/notam.ts) is the new action that
-- writes an action='cancelled' row and reuses the existing 'cancelled'
-- status (already used for a pilot's own pre-decision self-cancel) so a
-- cancelled-after-publish request is distinguishable in the UI by having
-- both a notam_code AND status='cancelled'.
create table if not exists flight_request_decisions (
  id uuid primary key default gen_random_uuid(),
  flight_request_id uuid not null references flight_requests (id) on delete cascade,
  action text not null check (action in ('published', 'rejected', 'cancelled')),
  notam_code text,
  notes text,
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz not null default timezone('utc', now())
);

create index if not exists flight_request_decisions_request_id_idx on flight_request_decisions (flight_request_id, decided_at);

alter table flight_request_decisions enable row level security;

-- Internal accountability record, same "dispatcher_admin only" scope as
-- CoordinationPanel/CoordinationAuthoritiesCard -- never surfaced to the
-- pilot/org side (they already get the outcome via the existing
-- notifications insert at decision time).
drop policy if exists "Dispatcher admins manage decision history" on flight_request_decisions;
create policy "Dispatcher admins manage decision history"
  on flight_request_decisions for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());
