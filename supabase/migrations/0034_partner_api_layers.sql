-- Foundation for the admin-managed partner API: the app's map is modeled as
-- three independently-embeddable layers (map+inspect, zones, action
-- buttons), matching the client-side code split in src/lib/map-layers.
-- Admins can issue a scoped API key per layer for partners to consume, and
-- separately point a layer at a partner's own API instead of our data.

create type api_layer as enum ('map', 'zones', 'actions');

create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  layer api_layer not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index api_keys_layer_idx on api_keys (layer) where revoked_at is null;

alter table api_keys enable row level security;

create policy "Dispatcher admins manage api keys"
  on api_keys for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());

-- Per-layer override: when set, that layer's data is expected to come from
-- a partner's own API instead of ours (the client-side embed reads this).
create table layer_source_overrides (
  layer api_layer primary key,
  override_url text,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references profiles (id) on delete set null
);

alter table layer_source_overrides enable row level security;

create policy "Anyone reads layer overrides"
  on layer_source_overrides for select
  to authenticated
  using (true);

create policy "Dispatcher admins write layer overrides"
  on layer_source_overrides for all
  using (is_dispatcher_admin())
  with check (is_dispatcher_admin());
