-- A report outlives the account it was filed about.
--
-- `member_reports.reporter_id` and `reported_id` both reference `profiles` with
-- ON DELETE CASCADE, and `profiles.id` references `auth.users` the same way. So
-- deleting an account deletes every report filed about that account, and every
-- report that account filed about somebody else. `delete_my_account()` has no
-- guard: a member who has been reported can press "Delete my account" and the
-- reports go with them, silently, by design, through a chain nobody meant to
-- build.
--
-- It is not only the in-app path. 20260920120100 enumerated the others and they
-- all still apply: the Supabase dashboard, the admin API, `npm run demo:remove`,
-- and the throwaway accounts the probes create and destroy on every run.
--
-- ---------------------------------------------------------------------------
-- Why an archive rather than fixing the foreign keys
-- ---------------------------------------------------------------------------
--
-- The correct long-term shape is `on delete set null` plus a tombstone, and it
-- is written up in docs/child-safety-reporting-revised-proposal.md. It is also
-- the one change in this piece of work that mutates existing rows: two foreign
-- keys altered, two columns made nullable, two added, a backfill, and
-- `admin_list_reports` corrected -- its two joins to `profiles` are INNER, so a
-- report whose reporter had left would vanish from the queue even with the
-- foreign key fixed. Rows already null-ed by a real deletion could not be
-- recovered if any of it were wrong, and there is no second database here to
-- rehearse it on.
--
-- This does the thing that matters -- the reports survive -- by only ever
-- inserting. No existing table, column, constraint or policy is altered, apart
-- from widening one CHECK to admit a new audit verb. If it has to come out, the
-- recovery is `drop trigger`, one statement, and the database is exactly as it
-- was.
--
-- ---------------------------------------------------------------------------
-- What this does NOT preserve, deliberately
-- ---------------------------------------------------------------------------
--
-- Report metadata and the reporter's own words. Not messages, and not
-- photographs.
--
-- The reporter's description is the part that "actually says what happened"
-- (20260830160300's phrase), and it is written by the one person in the
-- exchange who is not the subject of the complaint. Keeping it, with the
-- category and the timeline, keeps a report readable and a pattern visible.
--
-- Keeping the *material* is a different act with a different risk. Retaining a
-- suspected child sexual abuse image means Eraya knowingly holds it, and that
-- must not be built before somebody qualified has said on what basis, with what
-- access controls and for how long. See docs/17-child-safety.md, which records
-- the question rather than inventing an answer. Nothing here copies a photo,
-- holds a storage object, or stores image bytes.

-- ---------------------------------------------------------------------------
-- The archive
-- ---------------------------------------------------------------------------
--
-- Every column is nullable and there is no foreign key anywhere, which is not
-- laziness: this table is written from inside a DELETE cascade, and a trigger
-- that raises there takes the whole transaction with it. 20260920120100 added a
-- trigger to this exact table and broke account deletion outright -- the admin
-- API started answering "Database error deleting user" with a 500 -- and it had
-- to be backed out one migration later. A foreign key to `profiles` would be
-- the same bug by a different route, since the row it pointed at is the one
-- being deleted. A NOT NULL on a column that turns out to be null in some
-- report filed last August would be another.
--
-- So the only constraint is the primary key, and the insert below handles it
-- with ON CONFLICT. There is nothing left that can fail.
--
-- `reason_code` and `status` are text rather than their enums. An archive has
-- to keep reading correctly after the type it was copied from has moved on, and
-- a stored label is readable whatever happens to `report_reason` later.

create table if not exists public.member_reports_archive (
  -- The original report's id, so a report is archived once however many times
  -- the trigger sees it.
  id uuid primary key,

  reporter_id uuid,
  reported_id uuid,
  reason_code text,
  description text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,

  archived_at timestamptz not null default now(),
  -- Whose deletion caused this. Tells a moderator whether the person reported
  -- left or the person reporting did, which changes what the report means.
  archived_for uuid
);

comment on table public.member_reports_archive is
  'Reports preserved from the ON DELETE CASCADE that runs when an account is deleted. Metadata and the reporter''s own description only -- never messages, photographs or storage objects. No policies: reachable only through admin_list_archived_reports() behind is_moderator().';

comment on column public.member_reports_archive.archived_for is
  'The profile whose deletion caused this row to be written. May be the reporter or the reported member.';

create index if not exists member_reports_archive_reported_idx
  on public.member_reports_archive (reported_id, created_at desc);

-- Unreachable by any client, the same way `moderation_actions` is: RLS on, and
-- deliberately not one policy. A table with RLS and no policies answers every
-- client with nothing, which is the correct default for something only a
-- definer function should ever read.
alter table public.member_reports_archive enable row level security;

-- Belt as well as braces, and for the documented reason: a grant to PUBLIC is
-- inherited by `anon` and `authenticated`, so naming only the latter two would
-- leave the inherited grant standing. RLS would still refuse the rows; this
-- means a client cannot even reach the table to be refused.
revoke all on public.member_reports_archive from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Copy before the cascade
-- ---------------------------------------------------------------------------
--
-- BEFORE DELETE, which is the whole mechanism. Referential actions are carried
-- out by Postgres as AFTER triggers on the referenced table, so at BEFORE
-- DELETE time on `profiles` the rows in `member_reports` are still there to be
-- read. An AFTER DELETE trigger -- which is what the photo trigger was -- would
-- be racing the cascade it is trying to outlive.
--
-- It fires however the row came to be deleted, including when it is cascaded
-- from `auth.users`, which covers every deletion route listed at the top.
--
-- Both directions in one statement. A report is archived when the member it
-- names leaves and when the member who filed it leaves, because a report with
-- no reporter is still evidence about the person reported.
--
-- If both parties delete their accounts, the first deletion archives the report
-- and the cascade then removes the original, so the second deletion finds
-- nothing to copy. ON CONFLICT covers the case anyway rather than relying on
-- that ordering holding.
--
-- There is no exception handler, and that is a decision rather than an
-- oversight. Catching and returning would guarantee that deletion never breaks,
-- at the cost of losing the evidence this exists to preserve -- quietly, which
-- is the shape of failure `docs/11` describes for the analytics pipeline that
-- "shipped that way once and measured nothing". Since the table above has no
-- constraint that can fail, the honest trade is a loud failure that `drop
-- trigger` fixes in one statement over a silent one nobody discovers.

create or replace function public.archive_member_reports()
returns trigger
language plpgsql
volatile
-- Definer because the caller is rarely the owner. An admin deleting somebody
-- from the dashboard is `supabase_auth_admin`; a member deleting themselves is
-- `authenticated`. Neither may write this table, and granting them that so the
-- function could run as invoker would hand every signed-in member the ability
-- to write the moderation archive.
security definer
-- Pinned, for the reason every definer function here pins it: a definer
-- function must never resolve a name through a caller-controlled path.
set search_path = public
as $$
begin
  insert into public.member_reports_archive (
    id,
    reporter_id,
    reported_id,
    reason_code,
    description,
    status,
    created_at,
    reviewed_at,
    reviewed_by,
    archived_for
  )
  select r.id,
         r.reporter_id,
         r.reported_id,
         r.reason_code::text,
         r.description,
         r.status::text,
         r.created_at,
         r.reviewed_at,
         r.reviewed_by,
         old.id
    from public.member_reports r
   where r.reporter_id = old.id
      or r.reported_id = old.id
  on conflict (id) do nothing;

  return old;
end;
$$;

comment on function public.archive_member_reports() is
  'Copies a departing member''s reports into member_reports_archive before the ON DELETE CASCADE removes them. Both directions: reports about them and reports they filed.';

-- Revoking does not stop the trigger -- Postgres checks EXECUTE when the
-- trigger is created, not each time it fires -- but it stops the function being
-- called as an API endpoint by name, which is the only other way to reach it.
revoke execute on function public.archive_member_reports() from public, anon, authenticated;

drop trigger if exists profiles_archive_reports on public.profiles;

create trigger profiles_archive_reports
  before delete on public.profiles
  for each row
  execute function public.archive_member_reports();

-- ---------------------------------------------------------------------------
-- Reading it, and recording that it was read
-- ---------------------------------------------------------------------------
--
-- `moderation_actions.action` is constrained to a known list, so a new verb has
-- to be admitted before it can be written. Widening a CHECK cannot fail against
-- existing rows: every value that was allowed still is.

alter table public.moderation_actions
  drop constraint if exists moderation_actions_known;

alter table public.moderation_actions
  add constraint moderation_actions_known
    check (action in ('dismissed', 'suspended', 'restored', 'archive_viewed'));

comment on constraint moderation_actions_known on public.moderation_actions is
  'The moderation verbs that exist. ''archive_viewed'' records a moderator opening the preserved reports of deleted accounts -- reading a departed member''s report is itself an act worth having on the record.';

-- Same boundary as every other admin function: the check is in the body, it
-- raises rather than returning quietly, and it is re-checked here even though
-- the web guard already answered 404 -- because a server action is a public
-- endpoint and an RPC is callable by name by anything that can sign in.
--
-- The audit row is written before the rows are returned, so there is no path
-- that reads the archive without leaving a trace. It carries no report id: this
-- is a list, and naming one of two hundred rows would be arbitrary.

create or replace function public.admin_list_archived_reports()
returns table (
  id uuid,
  reason_code text,
  description text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reporter_id uuid,
  reported_id uuid,
  archived_at timestamptz,
  archived_for uuid,
  is_child_safety boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Not permitted' using errcode = '42501';
  end if;

  insert into public.moderation_actions (actor, action, note)
  values (auth.uid(), 'archive_viewed', 'Opened the preserved reports of deleted accounts');

  return query
    select a.id,
           a.reason_code,
           a.description,
           a.status,
           a.created_at,
           a.reviewed_at,
           a.reporter_id,
           a.reported_id,
           a.archived_at,
           a.archived_for,
           a.reason_code in ('csae', 'underage')
      from public.member_reports_archive a
     order by (a.reason_code in ('csae', 'underage')) desc,
              a.archived_at desc
     limit 200;
end;
$$;

comment on function public.admin_list_archived_reports() is
  'Reports preserved from a deleted account. Raises 42501 for anyone not on the moderation allowlist, and records every read in moderation_actions. Child safety reports first.';

revoke execute on function public.admin_list_archived_reports() from public, anon;
grant execute on function public.admin_list_archived_reports() to authenticated;
