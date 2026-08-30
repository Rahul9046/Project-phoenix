-- Let photos be reordered, and cap them by count rather than by position.
--
-- The original table said `position >= 0 and position < 6`, using the position
-- column to enforce both the ordering and the six-photo limit. Those are two
-- different rules and conflating them breaks reordering: a unique index on
-- (profile_id, position) means positions cannot be reassigned in place -- the
-- first update collides with the row still holding the target position -- and
-- the standard way through that is to move every row temporarily out of range
-- and back. With a ceiling of 6 there is no out of range to move to.
--
-- So the position becomes what it says it is, an ordering, and the limit becomes
-- what it is, a count. A trigger enforces the count, which is also stricter than
-- the old check ever was: the previous constraint would have allowed a seventh
-- photo at position 0 if two rows had somehow shared one.

alter table public.profile_photos
  drop constraint if exists profile_photos_position_range;

alter table public.profile_photos
  add constraint profile_photos_position_non_negative
    check (position >= 0);

create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.profile_photos where profile_id = new.profile_id) >= 6 then
    raise exception 'A profile may have at most six photos'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_photos_limit
  before insert on public.profile_photos
  for each row execute function public.enforce_photo_limit();

comment on column public.profile_photos.position is
  'Ordering only. The lowest is shown first. Six-photo limit is enforced by the profile_photos_limit trigger.';
