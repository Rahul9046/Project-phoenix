-- Reporting somebody blocks them, in one transaction.
--
-- Both clients did this in two calls: insert a report, then insert a block.
-- Both carried the same comment explaining that the block runs even if the
-- report failed, which is the right instinct and the wrong place for it -- it
-- is a rule about what reporting *means*, enforced twice, in two languages, by
-- two teams who have to remember. The failure it does not cover is the one
-- that matters: the report is written, the network drops, the block never
-- happens, and a member who has just told us they are frightened of somebody
-- is still visible to them.
--
-- So one function. Either both rows exist or neither does, and no client can
-- file a report without the block that goes with it.
--
-- The RLS insert policy on `member_reports` stays exactly as it was. This adds
-- a way in; it does not take one away, and nothing about who may read a report
-- changes -- which is still nobody, through any path, except
-- `admin_list_reports` behind `is_moderator()`.

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
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
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
