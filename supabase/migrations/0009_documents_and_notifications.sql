-- Module D: document uploads + OCR pipeline state, and the notification
-- outbox the expiry cron job (0011) and NOTAM publish action write to.

create type document_kind as enum ('pilot_license', 'drone_registration', 'insurance_certificate');
create type document_ocr_status as enum ('pending', 'processing', 'completed', 'failed');

create table documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind document_kind not null,
  storage_path text not null,
  linked_license_id uuid references pilot_licenses (id) on delete set null,
  ocr_status document_ocr_status not null default 'pending',
  ocr_extracted_expires_at date,
  ocr_confidence numeric(4, 3),
  uploaded_at timestamptz not null default timezone('utc', now())
);

create index documents_user_id_idx on documents (user_id);
create index documents_ocr_status_idx on documents (ocr_status);

create type notification_kind as enum (
  'license_expiring',
  'notam_published',
  'inspection_required',
  'battery_wear'
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_id_idx on notifications (user_id);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

-- Secure private bucket for license/registration documents. Files are keyed
-- as "{auth.uid()}/{filename}" so the storage RLS policies below can scope
-- access to the owning pilot without a lookup table.
insert into storage.buckets (id, name, public)
values ('licenses', 'licenses', false)
on conflict (id) do nothing;

create policy "Pilots read their own license documents"
  on storage.objects for select
  using (
    bucket_id = 'licenses'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Pilots upload their own license documents"
  on storage.objects for insert
  with check (
    bucket_id = 'licenses'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Pilots delete their own license documents"
  on storage.objects for delete
  using (
    bucket_id = 'licenses'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Dispatcher admins read all license documents"
  on storage.objects for select
  using (bucket_id = 'licenses' and is_dispatcher_admin());
