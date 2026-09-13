-- Private bucket for generated PDF regulatory reports (Module C export).
-- Files are written by the service-role client from the `exportFlightReport`
-- server action and handed back to the pilot as a short-lived signed URL,
-- so no public or authenticated-read policy is needed here.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

create policy "Pilots read their own generated reports"
  on storage.objects for select
  using (
    bucket_id = 'reports'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );
