-- "Something else", followed by a newline, is still nothing.
--
-- 20260920110100 and 20260920110200 both leant on `btrim(description)` to
-- decide whether a report said anything. `btrim` with one argument strips
-- *spaces* and nothing else -- not a newline, not a tab -- so a reason of
-- "other" with a details field containing only a return arrived as a
-- one-character string, passed both the function and the constraint, and was
-- filed as a report that tells a moderator nothing.
--
-- Found by `npm run moderation:probe`, which is the point of having it.
--
-- Corrected in a third migration rather than by editing the first two, because
-- those have already run: a migration that has been applied is a record of what
-- happened to the database, and rewriting it makes the file disagree with every
-- environment that ran the original.

create or replace function public.report_and_block_member(
  p_target uuid,
  p_reason public.report_reason,
  p_details text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  -- Every kind of whitespace, at both ends. `btrim` would leave the newline.
  v_details text := nullif(
    regexp_replace(coalesce(p_details, ''), '^\s+|\s+$', '', 'g'),
    ''
  );
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_target is null or p_target = me then
    raise exception 'invalid target' using errcode = '22023';
  end if;

  -- The category is typed, so an identifier that is not one of ours has
  -- already been refused by the time this body runs. Null is the case the type
  -- cannot catch: PostgREST is happy to omit an argument, and a report with no
  -- reason is the free-text column this design replaced.
  if p_reason is null then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  -- "Other" means the category said nothing, so the words have to.
  if p_reason = 'other' and v_details is null then
    raise exception 'details are required for this reason' using errcode = '22023';
  end if;

  if length(v_details) > 2000 then
    raise exception 'details are too long' using errcode = '22001';
  end if;

  insert into public.member_reports (reporter_id, reported_id, reason_code, description)
  values (me, p_target, p_reason, v_details);

  -- Already blocked is not an error. Someone reporting a person they blocked
  -- last week is doing the sensible thing, and telling them it failed would be
  -- a lie about the only part of this that protects them.
  insert into public.member_blocks (blocker_id, blocked_id)
  values (me, p_target)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

comment on function public.report_and_block_member(uuid, public.report_reason, text) is
  'Files a report and blocks the reported member, atomically. The only path either client uses; reporting without blocking is not offered.';

revoke execute on function public.report_and_block_member(uuid, public.report_reason, text)
  from public, anon;
grant execute on function public.report_and_block_member(uuid, public.report_reason, text)
  to authenticated;

-- The constraint had the same hole, and it is the one that matters for the
-- insert policy on `member_reports` -- a client writing the row directly never
-- passes through the function at all.
--
-- Still NOT VALID, and for the same reason: reports filed before any of this
-- existed are left exactly as they were written.

alter table public.member_reports
  drop constraint if exists member_reports_other_needs_description;

alter table public.member_reports
  add constraint member_reports_other_needs_description
    check (
      reason_code <> 'other'
      or (description is not null and description !~ '^\s*$')
    )
    not valid;

comment on constraint member_reports_other_needs_description on public.member_reports is
  'A report of "other" must say what happened, and whitespace does not count. NOT VALID: reports filed before the rule existed are left as they were.';
