-- Two of the freelancer-booking-flow asks that don't touch scheduling:
--   1. A pilot's rate card (hourly/daily/equipment) — kept in its own table,
--      never joined into the marketplace-browse RPCs (marketplace_freelancers /
--      get_marketplace_pilot_profile), since prices are deliberately NOT
--      exposed on the public marketplace (agreed: negotiated in-chat instead,
--      see 0062+). Unlike `pilot_profiles` (0051), this table gets NO blanket
--      "org accounts read" policy — that's exactly the exposure this needs to
--      avoid, matching the phone-number lesson from 0049.
--   2. A portfolio gallery so a pilot can show past work to an org evaluating
--      them. Unlike pricing this *is* meant to be browsed pre-hire, so org
--      accounts get read access to the metadata rows; the backing files stay
--      in a private bucket (signed URLs generated on demand, same convention
--      `licenses` already uses in 0009/0013 and src/actions/documents.ts).

create table pilot_pricing (
  pilot_id uuid primary key references profiles (id) on delete cascade,
  hourly_rate_ils numeric(10, 2) check (hourly_rate_ils is null or hourly_rate_ils >= 0),
  daily_rate_ils numeric(10, 2) check (daily_rate_ils is null or daily_rate_ils >= 0),
  -- [{ "name": "מצלמה תרמית", "price_ils": 300 }, ...] — an open list since
  -- extra-equipment pricing has no fixed taxonomy across pilots.
  equipment_rates jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table pilot_pricing enable row level security;

create trigger pilot_pricing_set_updated_at
  before update on pilot_pricing
  for each row execute function set_updated_at();

create policy "Pilots manage their own pricing"
  on pilot_pricing for all
  using (pilot_id = auth.uid())
  with check (pilot_id = auth.uid());

create policy "Dispatcher admins read all pricing"
  on pilot_pricing for select
  using (is_dispatcher_admin());

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------

create table portfolio_items (
  id uuid primary key default uuid_generate_v4(),
  pilot_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index portfolio_items_pilot_id_idx on portfolio_items (pilot_id, sort_order);

alter table portfolio_items enable row level security;

create policy "Pilots manage their own portfolio items"
  on portfolio_items for all
  using (pilot_id = auth.uid())
  with check (pilot_id = auth.uid());

create policy "Org accounts and admins read portfolio items"
  on portfolio_items for select
  using (current_org_id() is not null or is_dispatcher_admin());

insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', false)
on conflict (id) do nothing;

create policy "Pilots manage their own portfolio files"
  on storage.objects for all
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Org accounts and admins view portfolio files"
  on storage.objects for select
  using (bucket_id = 'portfolio' and (current_org_id() is not null or is_dispatcher_admin()));
