-- All of a member's photos, not just the first.
--
-- `member_card` carries one path and a count, which is right for a list -- a
-- card shows one picture, and fetching every path for every row would be waste
-- on a screen that renders none of them.
--
-- A profile is the opposite: it shows all of them, and only for one person at a
-- time. So this is a separate call rather than a wider card, which keeps the
-- list query cheap and avoids widening the composite type that defines the
-- privacy boundary -- every field added there is a field exposed on every
-- member, everywhere.
--
-- Same visibility rule as everything else: `member_profile` decides whether the
-- caller may see this person at all, and returning nothing when it says no is
-- what keeps a blocked member's photos out of reach by direct call.

create or replace function public.member_photos(member_id uuid)
-- `position` is reserved in a RETURNS TABLE list, hence the prefix.
returns table (storage_path text, photo_position smallint)
language sql
stable
security definer
set search_path = public
as $$
  select ph.storage_path, ph.position
  from public.profile_photos ph
  where ph.profile_id = member_id
    -- Reuses the one place that answers "may the caller see this member".
    and exists (select 1 from public.member_profile(member_id))
  order by ph.position;
$$;

revoke execute on function public.member_photos(uuid) from public, anon;
grant execute on function public.member_photos(uuid) to authenticated;

comment on function public.member_photos(uuid) is
  'Every photo of one member, in their order. Returns nothing when member_profile would -- a blocked member''s photos are not reachable by direct call.';
