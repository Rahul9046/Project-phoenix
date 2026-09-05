-- Reports with a shape, and knowing what you have not read.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
--
-- `member_reports.reason` is free text today. That was fine when nothing read
-- it; it stops being fine the moment someone does, because "he was weird" and
-- "she asked me for money" need completely different responses and a free-text
-- column cannot be counted, sorted or triaged.
--
-- So: a category from a fixed list, plus the description in the person's own
-- words. The category makes the queue workable; the description is the part that
-- actually says what happened, and dropping it would be worse than having no
-- structure at all.
--
-- A status column, because a report that has been acted on and a report nobody
-- has opened are different things and the difference will matter. Note what this
-- does *not* do: nothing in the product tells a member their report will be
-- reviewed, because no review process exists yet. The column is here so that
-- when one does, it has somewhere to record itself.

create type public.report_reason as enum (
  'fake_profile',
  'harassment',
  'inappropriate_content',
  'scam',
  'incorrect_relationship_status',
  'other'
);

create type public.report_status as enum (
  'received',
  'reviewing',
  'actioned',
  'dismissed'
);

alter table public.member_reports
  add column reason_code public.report_reason not null default 'other',
  add column status public.report_status not null default 'received';

-- The old column keeps the person's own words; it is simply no longer the only
-- thing recorded. Renaming it says so, and leaves no ambiguity about which of
-- the two a query means.
alter table public.member_reports rename column reason to description;

alter table public.member_reports
  alter column description drop not null;

alter table public.member_reports
  drop constraint if exists member_reports_reason_not_blank;

alter table public.member_reports
  add constraint member_reports_description_length
    check (description is null or length(description) <= 2000);

comment on column public.member_reports.reason_code is
  'The category chosen from a fixed list, so reports can be triaged.';
comment on column public.member_reports.description is
  'Optional. What happened, in the reporter''s own words.';
comment on column public.member_reports.status is
  'Where the report has got to. No review process exists yet; nothing in the product promises one.';

create index member_reports_open_idx
  on public.member_reports (status, created_at)
  where status in ('received', 'reviewing');

-- ---------------------------------------------------------------------------
-- Unread, without read receipts
-- ---------------------------------------------------------------------------
--
-- The inbox needs to show which conversations have something new in them. The
-- obvious way to do that is `messages.read_at`, and the original migration
-- refuses to add that column on purpose: it is one query away from a read
-- receipt, and read receipts exist to make one person feel watched and the other
-- feel owed a reply.
--
-- The distinction that makes this safe is direction. "What have *I* not read" is
-- a fact about me and is useful. "Has *she* read it" is a fact about her,
-- disclosed to someone else, and is the thing to avoid. So the marker lives on
-- the connection, one per participant, and is readable only by the person it
-- belongs to -- there is no query, from any client, that tells you when the
-- other person last opened the conversation.

alter table public.connections
  add column member_a_read_at timestamptz,
  add column member_b_read_at timestamptz;

comment on column public.connections.member_a_read_at is
  'When member_a last opened this conversation. Their own unread marker; never disclosed to member_b.';
comment on column public.connections.member_b_read_at is
  'When member_b last opened this conversation. Their own unread marker; never disclosed to member_a.';

/*
 * Marking a conversation read.
 *
 * A function rather than an update policy on the columns, because an update
 * policy on `connections` already exists for ending a connection and widening it
 * would let a client write the *other* person's marker -- which is exactly the
 * disclosure this design avoids. Here the caller cannot choose which column is
 * written; their own identity decides.
 */
create or replace function public.mark_conversation_read(connection_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  update public.connections c
     set member_a_read_at = case when c.member_a = me then now() else c.member_a_read_at end,
         member_b_read_at = case when c.member_b = me then now() else c.member_b_read_at end
   where c.id = connection_id
     and me in (c.member_a, c.member_b);
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

comment on function public.mark_conversation_read(uuid) is
  'Records that the caller has opened a conversation. Writes only the caller''s own marker.';
