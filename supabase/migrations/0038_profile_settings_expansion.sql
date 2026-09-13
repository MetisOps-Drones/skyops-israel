-- Profile redesign: avatar upload + a settings menu whose content is scoped by account tier
-- (pilot_hobby gets almost nothing extra; pilot_pro/org get business + notification fields).
-- Org *management* (team, shared fleet, billing) stays out of scope here — that's "הארגון שלי".

alter table profiles
  add column if not exists title text,
  add column if not exists business_id text,
  add column if not exists bio text,
  add column if not exists freelance_available boolean not null default false,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_sms boolean not null default false;

-- Public-read bucket: avatars are displayed to other org members / dispatchers, so unlike the
-- private `licenses` bucket a signed URL per view isn't worth the overhead. Write access is
-- still locked to the owner's own folder, same convention as `licenses`.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Pilots upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Pilots replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "Pilots delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );
