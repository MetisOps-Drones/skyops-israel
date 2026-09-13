-- flight_logs.client_name was free text re-typed on every entry, so
-- "profitability by client" was really profitability by spelling. This adds
-- a real clients table a pilot (or their org, when shared) reuses across
-- entries and can see real history against — no pipeline stages, no tasks,
-- just name + contact + notes and a foreign key from flight_logs. client_name
-- stays on flight_logs (denormalized copy, kept for legacy rows and simple
-- display without a join).

create table clients (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles (id) on delete cascade,
  org_id uuid references organizations (id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index clients_owner_id_idx on clients (owner_id);
create index clients_org_id_idx on clients (org_id) where org_id is not null;

alter table clients enable row level security;

create policy "Pilots manage their own clients"
  on clients for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (org_id is null or org_id = current_org_id()));

create policy "Org members read shared clients"
  on clients for select
  using (org_id is not null and is_same_org(org_id));

create policy "Dispatcher admins read all clients"
  on clients for select
  using (is_dispatcher_admin());

alter table flight_logs
  add column client_id uuid references clients (id) on delete set null;

create index flight_logs_client_id_idx on flight_logs (client_id) where client_id is not null;
