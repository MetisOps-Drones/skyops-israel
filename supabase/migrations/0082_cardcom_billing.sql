-- Real billing, replacing the "demo checkout" convention (PlanCatalog /
-- CreateOrgButton just wrote plan_code and org rows for free, with a toast
-- saying "מצב הדגמה"). This migration does two things:
--
-- 1. Schema for a Cardcom-backed checkout: a pending `billing_checkouts` row
--    is created before redirecting to Cardcom's hosted LowProfile page; only
--    the webhook handler (src/app/api/webhooks/cardcom/route.ts), running
--    with the service-role key after independently re-confirming the
--    payment against Cardcom's own API, is trusted to mark it paid and
--    apply it (create the org / activate the plan). `billing_subscriptions`
--    tracks the recurring monthly state (saved card token + next billing
--    date) that the renewal cron (src/app/api/cron/charge-recurring-
--    subscriptions/route.ts) charges. `billing_invoices` records the
--    documents Cardcom auto-issues per charge.
--
-- 2. Closes the two ways a plan/org upgrade could be granted for free
--    without this schema even existing:
--    - `create_organization_as_owner` was granted to every authenticated
--      user directly — callable from the browser console, bypassing the
--      UI "paywall" entirely. Revoked; only the webhook (service_role)
--      creates orgs now.
--    - `profiles.plan_code` had no protection beyond "you can edit your
--      own profile" — any authenticated user could set their own
--      plan_code to a paid tier via a plain `.update()`. A trigger now
--      blocks setting it to anything but a free-tier code unless the
--      write comes from the service role (i.e. the webhook).

create table billing_checkouts (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles (id) on delete cascade,
  plan_code text not null,
  -- Only set when checking out an org tier — the org doesn't exist yet at checkout time, so the
  -- name is held here and the org is created once payment is confirmed.
  intended_org_name text,
  /** Whether activating this checkout should also switch the profile's role to pilot_pro (business-tier upgrade from a private account). */
  switch_to_pro boolean not null default false,
  amount_ils numeric(10, 2) not null,
  cardcom_low_profile_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  cardcom_token text,
  cardcom_token_expiry text,
  -- Set only for the business/org "free week trial" signup path — the checkout saves a card via
  -- Cardcom's token-only operation (nothing charged yet) instead of charging amount_ils
  -- immediately; the recurring-billing cron makes the real first charge when this date arrives.
  trial_ends_at timestamptz,
  /** Set once a paid checkout has actually been applied (org created / plan activated) — a paid-but-unconsumed row can only ever be applied once. */
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index billing_checkouts_profile_idx on billing_checkouts (profile_id);

alter table billing_checkouts enable row level security;

create policy "Users read their own checkouts"
  on billing_checkouts for select
  using (profile_id = auth.uid());

-- initiateCheckout (src/actions/billing.ts) runs with the caller's own
-- session, not service_role, and needs to insert the pending row itself
-- and then patch in cardcom_low_profile_id (or mark it failed) once
-- Cardcom responds. Row-level access is intentionally permissive (own
-- rows only) — the tamper guard below is what actually keeps this safe:
-- without it, a user could set their own amount_ils to whatever Cardcom
-- charge they actually intend to pay (or status straight to 'paid'),
-- and the webhook's amount/status checks would trust the tampered row.
create policy "Users create their own checkouts"
  on billing_checkouts for insert
  with check (
    profile_id = auth.uid()
    and status = 'pending'
    and consumed_at is null
    and cardcom_token is null
  );

create policy "Users update their own checkouts"
  on billing_checkouts for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function prevent_checkout_tamper()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  -- Only what initiateCheckout itself needs to set post-insert: recording
  -- Cardcom's LowProfileId, or marking the checkout failed if Cardcom's
  -- create-checkout call itself errored. Everything that actually decides
  -- what gets granted (amount, plan, paid/consumed) stays webhook-only.
  if new.amount_ils is distinct from old.amount_ils
     or new.plan_code is distinct from old.plan_code
     or new.profile_id is distinct from old.profile_id
     or new.intended_org_name is distinct from old.intended_org_name
     or new.switch_to_pro is distinct from old.switch_to_pro
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.consumed_at is distinct from old.consumed_at
     or new.cardcom_token is distinct from old.cardcom_token
     or new.cardcom_token_expiry is distinct from old.cardcom_token_expiry
     or (new.status is distinct from old.status and new.status not in ('pending', 'failed')) then
    raise exception 'רק תהליך האימות מול הסליקה רשאי לעדכן שדות אלו';
  end if;
  return new;
end;
$$;

create trigger billing_checkouts_prevent_tamper
  before update on billing_checkouts
  for each row execute function prevent_checkout_tamper();

create table billing_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references profiles (id) on delete cascade,
  org_id uuid references organizations (id) on delete cascade,
  -- Always populated (whether this is an org or a private/business subscription) — who actually
  -- checked out and holds the card, distinct from `profile_id` which is only set for a
  -- non-org subscription. Invoicing/notifications key off this, not profile_id, so an org
  -- subscription always has a real profile to attribute a charge/notification to.
  created_by_profile_id uuid not null references profiles (id) on delete cascade,
  plan_code text not null,
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  cardcom_token text not null,
  cardcom_token_expiry text,
  amount_ils numeric(10, 2) not null,
  next_billing_date date not null,
  failed_attempts int not null default 0,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint billing_subscriptions_single_owner check (
    (profile_id is not null and org_id is null) or (profile_id is null and org_id is not null)
  )
);

-- At most one non-cancelled subscription per owner.
create unique index billing_subscriptions_profile_active_uidx
  on billing_subscriptions (profile_id) where org_id is null and status <> 'cancelled';
create unique index billing_subscriptions_org_active_uidx
  on billing_subscriptions (org_id) where org_id is not null and status <> 'cancelled';

alter table billing_subscriptions enable row level security;

create policy "Users read their own subscription"
  on billing_subscriptions for select
  using (profile_id = auth.uid());

create policy "Org members read their org's subscription"
  on billing_subscriptions for select
  using (org_id is not null and org_id = current_org_id());

create table billing_invoices (
  id uuid primary key default uuid_generate_v4(),
  checkout_id uuid references billing_checkouts (id) on delete set null,
  subscription_id uuid references billing_subscriptions (id) on delete set null,
  profile_id uuid not null references profiles (id) on delete cascade,
  amount_ils numeric(10, 2) not null,
  cardcom_document_number text,
  cardcom_document_url text,
  cardcom_transaction_id text,
  issued_at timestamptz not null default timezone('utc', now())
);

create index billing_invoices_profile_idx on billing_invoices (profile_id);

alter table billing_invoices enable row level security;

create policy "Users read their own invoices"
  on billing_invoices for select
  using (profile_id = auth.uid());

create trigger billing_checkouts_set_updated_at
  before update on billing_checkouts
  for each row execute function set_updated_at();

create trigger billing_subscriptions_set_updated_at
  before update on billing_subscriptions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Close the two free-upgrade paths
-- ---------------------------------------------------------------------------

revoke execute on function create_organization_as_owner(text) from authenticated;

create or replace function prevent_direct_paid_plan_change()
returns trigger
language plpgsql
as $$
begin
  if new.plan_code is distinct from old.plan_code
     and new.plan_code not in ('private_free', 'business_free')
     and auth.role() <> 'service_role' then
    raise exception 'שינוי לתוכנית בתשלום מתבצע רק דרך תהליך סליקה';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_direct_paid_plan_change
  before update on profiles
  for each row execute function prevent_direct_paid_plan_change();

alter type notification_kind add value 'subscription_payment_failed';
alter type notification_kind add value 'subscription_cancelled';

-- ---------------------------------------------------------------------------
-- A third free-upgrade path: handle_new_user() (0041) inserted plan_code
-- straight from the signup request's own metadata — entirely
-- client-controlled, and reachable with no authenticated session at all
-- (it fires on the auth.users insert itself). A crafted signup request
-- could set plan_code: 'org_unlimited' and get it for free from account
-- creation. Only the two zero-cost codes may pass through now; anything
-- else falls back to the free tier matching the account's role, and any
-- paid plan is applied afterwards through the same checkout flow as an
-- existing user upgrading (SignupWizard now redirects to Cardcom checkout
-- post-signup for a paid plan instead of setting it inline).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  resolved_role user_role;
  requested_plan_code text := new.raw_user_meta_data ->> 'plan_code';
  free_plan_code text;
begin
  resolved_role := case
    when lower(new.email) = 'ohad@metis-ops.com' then 'dispatcher_admin'::user_role
    else coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'pilot_hobby')
  end;

  free_plan_code := case when resolved_role = 'pilot_hobby' then 'private_free' else 'business_free' end;

  insert into public.profiles (id, full_name, role, plan_code, professional_category, freelance_available)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email, 'Pilot'),
    resolved_role,
    case
      when requested_plan_code in ('private_free', 'business_free') then requested_plan_code
      else free_plan_code
    end,
    new.raw_user_meta_data ->> 'professional_category',
    coalesce((new.raw_user_meta_data ->> 'freelance_available')::boolean, false)
  );
  return new;
end;
$$;
