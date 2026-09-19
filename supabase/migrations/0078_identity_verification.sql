-- Module D extension: ID-card (ת"ז) cross-check + face-match for pilot
-- license verification. Two new capabilities on top of the existing
-- license-upload/OCR pipeline (0009):
--   1. Upload/scan an ID card alongside the license and OCR-extract its
--      name + ID number, so the app can flag a mismatch against the
--      license's own printed name/number (a plain text comparison — no new
--      provider needed, reuses extractExpirationDate's OCR path).
--   2. A best-effort face-match between the ID card's photo and a live
--      camera capture of the person using the app, run entirely
--      client-side (face-api.js, no server/cloud dependency, no API key).
--      This is NOT identity-grade verification — no liveness/anti-spoof
--      check, so a printed photo can fool it — and is surfaced to pilots
--      and dispatchers as a consistency hint, never as proof of identity.
--      A real IDV provider (Onfido/Sumsub/Jumio-class) is the upgrade path
--      if stronger assurance is ever needed; identity_verifications.method
--      exists precisely so that swap doesn't need a schema change.

alter type document_kind add value 'id_card';

alter table documents
  add column ocr_extracted_name text,
  add column ocr_extracted_id_number text;

create type identity_verification_result as enum ('match', 'no_match', 'inconclusive', 'not_run');

create table identity_verifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles (id) on delete cascade,
  license_document_id uuid references documents (id) on delete set null,
  id_card_document_id uuid references documents (id) on delete set null,
  name_text_match boolean,
  id_number_text_match boolean,
  face_similarity numeric(5, 4),
  face_match_result identity_verification_result not null default 'not_run',
  method text not null default 'face_api_client',
  created_at timestamptz not null default timezone('utc', now())
);

create index identity_verifications_user_id_idx on identity_verifications (user_id);

alter table identity_verifications enable row level security;

create policy "Pilots manage their own identity verifications"
  on identity_verifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Dispatcher admins read all identity verifications"
  on identity_verifications for select
  using (is_dispatcher_admin());
