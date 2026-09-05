-- Photos.
--
-- The web app has none, deliberately: it renders a monogram and says so in its
-- own comments. That was the right call for a landing page and the first web
-- release, and it is not tenable for the mobile product -- deciding whether to
-- meet a stranger with no idea what they look like asks more of people than is
-- reasonable.
--
-- So photos become possible, and stay optional. Nothing here requires one, the
-- monogram remains a first-class presentation rather than a placeholder for a
-- failure, and a profile without a photo is complete. Eraya's members are people
-- who have had a hard few years; some will not want a face on a screen for a
-- long time, and the product should not treat them as half-finished.
--
-- The file itself lives in Supabase Storage. This table records the ordering and
-- which one is primary, because those are questions about a profile rather than
-- about a file, and because a storage listing has no stable order.

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- The object path inside the `profile-photos` bucket, always prefixed with the
  -- owner's id. The storage policies below key off that prefix, so a path that
  -- does not start with the caller's own id cannot be written -- which is what
  -- stops one member uploading into another's folder.
  storage_path text not null unique,

  -- Position in the person's own ordering. The lowest is the one shown first.
  position smallint not null default 0,

  created_at timestamptz not null default now(),

  constraint profile_photos_path_owned
    check (storage_path like (profile_id::text || '/%')),
  constraint profile_photos_position_range
    check (position >= 0 and position < 6)
);

comment on table public.profile_photos is
  'Optional profile photography. A profile with no rows here is normal, not incomplete.';

-- One person's photos, in their order. The only access pattern there is.
create unique index profile_photos_order_idx
  on public.profile_photos (profile_id, position);

-- ---------------------------------------------------------------------------
-- Who may see them
-- ---------------------------------------------------------------------------
--
-- Photos follow the same boundary as everything else about a member: you can see
-- them if the product has introduced you, and not otherwise. There is no public
-- read, so a photo URL cannot be shared out of the app into a browser and still
-- work.
--
-- Reading is done through the discovery functions rather than by selecting this
-- table directly, exactly as the rest of a member's data is. The select policy
-- here covers your own photos only; other people's arrive via `member_card`.

alter table public.profile_photos enable row level security;

create policy "Members manage their own photos"
  on public.profile_photos for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
--
-- Private. A public bucket would mean every photo is a guessable URL that
-- outlives a block, a deletion and an account closure, which is precisely the
-- kind of leak a product like this cannot afford. Clients read through signed
-- URLs with a short life instead.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Every object lives under a folder named for its owner's id, and these policies
-- are the enforcement of that. `storage.foldername(name)` splits the path, so
-- the first segment must equal the caller -- there is no way to write outside
-- your own folder, whatever the client sends.

create policy "Members read their own photo files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Members upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Members replace their own photo files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Members delete their own photo files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
