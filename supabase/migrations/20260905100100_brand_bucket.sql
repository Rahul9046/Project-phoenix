-- The Eraya mark, at an address an inbox can actually reach.
--
-- The sign-in email loaded the mark from `{{ .SiteURL }}/brand/eraya-mark.png`.
-- That is http://localhost:3000, so every recipient saw a broken image icon
-- where the logo should be -- and it would have stayed broken after a deploy for
-- anyone whose client fetches images through a proxy that cannot see a preview
-- URL. An email is read anywhere, by a program on someone else's machine; the
-- only host it can rely on is one that is public on the open internet.
--
-- Storage on this project is that host. It is already here for profile photos,
-- it is reachable without the website being deployed or the dev server running,
-- and its address does not change between local, preview and production.
--
-- Public, unlike `profile-photos`. The difference is the subject matter: a
-- guessable, permanent URL is exactly wrong for a member's photograph and
-- exactly right for a logo, which is on the website, in the app icon and on
-- every email already.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand',
  'brand',
  true,
  1024 * 1024,
  array['image/png', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No policies, deliberately, and the bucket is still readable.
--
-- `public = true` serves objects through /storage/v1/object/public/ without
-- consulting RLS at all, which is the whole point of the bucket. Writes are a
-- different question: with no insert, update or delete policy on
-- `storage.objects` for this bucket, no browser and no signed-in member can put
-- anything in it. Brand art is placed by whoever runs a deploy, holding the
-- service role, which bypasses RLS -- the same reasoning as `subscriptions`.
