-- Re-uploading a license to fix a mistake (e.g. a mistyped license_number)
-- should cleanly replace the prior record, not leave a stale duplicate
-- behind. The existing unique constraint included license_number itself,
-- so correcting a typo in that exact field created a second row instead of
-- superseding the first — the pilot would then see both the wrong and the
-- corrected license forever, with no way to remove the wrong one (there is,
-- deliberately, no direct field-edit UI — only "upload again" re-runs
-- verification from scratch).
--
-- Dedupe first: keep the most recently verified row per (user_id,
-- license_type) — ocr_extracted_at if set (an actual upload happened),
-- falling back to created_at — and drop the rest. documents.linked_license_id
-- references pilot_licenses `on delete set null` (0009), so the original
-- uploaded documents/OCR history for a superseded row is preserved even
-- after its summary row here is gone.
delete from pilot_licenses pl
where exists (
  select 1
  from pilot_licenses newer
  where newer.user_id = pl.user_id
    and newer.license_type = pl.license_type
    and (
      coalesce(newer.ocr_extracted_at, newer.created_at) > coalesce(pl.ocr_extracted_at, pl.created_at)
      or (
        coalesce(newer.ocr_extracted_at, newer.created_at) = coalesce(pl.ocr_extracted_at, pl.created_at)
        and newer.id > pl.id
      )
    )
);

alter table pilot_licenses drop constraint pilot_licenses_user_id_license_type_license_number_key;
alter table pilot_licenses add constraint pilot_licenses_user_id_license_type_key unique (user_id, license_type);
