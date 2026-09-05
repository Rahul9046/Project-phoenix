-- Seeing someone else's photo, and the inbox.

-- ---------------------------------------------------------------------------
-- Photo visibility
-- ---------------------------------------------------------------------------
--
-- The first storage policy let a member read only their own folder. That is
-- correct for uploading and useless for the product: nobody could see anybody
-- else's photo, which is the entire reason photos exist.
--
-- The replacement grants read to any signed-in member for any object whose owner
-- has not blocked them, and whom they have not blocked. Three things make that a
-- defensible boundary rather than an open bucket:
--
-- The bucket stays private. There is no anonymous read and no public URL; a
-- client has to be authenticated and then mint a signed URL that expires.
--
-- Paths are unguessable and are only ever handed out through `member_card`,
-- which already decides who may see whom. Knowledge of the path is the
-- capability, and the path comes from a function that enforces the rules.
--
-- Blocks are enforced here too, not just in discovery. A blocked person loses
-- access to the file itself, so a URL signed before the block cannot be renewed
-- and a saved path stops resolving.
--
-- What this deliberately does not do is restrict reads to existing connections.
-- Discovery has to show a face before anyone connects, and a policy that only
-- allowed connected members to load photos would make every discovery card
-- blank.

drop policy if exists "Members read their own photo files" on storage.objects;

create policy "Members read photos of people they may see"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and not exists (
      select 1 from public.member_blocks b
      where (
        b.blocker_id = (select auth.uid())
        and b.blocked_id::text = (storage.foldername(name))[1]
      ) or (
        b.blocked_id = (select auth.uid())
        and b.blocker_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- ---------------------------------------------------------------------------
-- The inbox
-- ---------------------------------------------------------------------------
--
-- One row per connection, with the other person on it and the last thing said.
--
-- A function rather than a client-side join. Building this in the app means
-- fetching every connection, then every profile, then the last message of each
-- -- the classic N+1, and on a phone on mobile data each of those round trips is
-- a visible pause. It also means the client decides who the "other" member is,
-- which is a rule, and rules belong in one place.
--
-- `unread` is computed from the caller's own marker only. There is no way, from
-- this function or any other, to learn when the other person last opened the
-- conversation -- see the note on `mark_conversation_read`.

create type public.conversation_row as (
  connection_id uuid,
  member public.member_card,
  last_message text,
  last_message_at timestamptz,
  last_message_from_me boolean,
  unread boolean,
  ended_at timestamptz,
  ended_by_me boolean
);

create or replace function public.my_conversations()
returns setof public.conversation_row
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  mine as (
    select
      c.id,
      case when c.member_a = me.id then c.member_b else c.member_a end as other_id,
      case when c.member_a = me.id then c.member_a_read_at else c.member_b_read_at end as my_read_at,
      c.ended_at,
      c.ended_by = me.id as ended_by_me
    from public.connections c, me
    where me.id in (c.member_a, c.member_b)
  ),
  latest as (
    select distinct on (m.connection_id)
      m.connection_id, m.body, m.created_at, m.sender_id
    from public.messages m
    join mine on mine.id = m.connection_id
    order by m.connection_id, m.created_at desc
  )
  select
    mine.id,
    card,
    latest.body,
    latest.created_at,
    latest.sender_id = me.id,
    -- Unread only when the newest message is theirs and arrived after the last
    -- time this person opened the conversation. Never true for your own.
    coalesce(
      latest.sender_id <> me.id
        and (mine.my_read_at is null or latest.created_at > mine.my_read_at),
      false
    ),
    mine.ended_at,
    coalesce(mine.ended_by_me, false)
  from mine
  cross join me
  cross join lateral public.member_profile(mine.other_id) as card
  left join latest on latest.connection_id = mine.id
  where card.id is not null
  -- Most recent conversation first; a connection with nothing said yet sorts by
  -- when it was made, so a new connection does not sink below an old thread.
  order by coalesce(latest.created_at, mine.ended_at, now()) desc;
$$;

revoke execute on function public.my_conversations() from anon;
grant execute on function public.my_conversations() to authenticated;

comment on function public.my_conversations() is
  'The inbox: every connection with the other member and the last message. Unread is computed from the caller''s own marker and never discloses the other person''s.';

-- ---------------------------------------------------------------------------
-- What needs attention
-- ---------------------------------------------------------------------------
--
-- The home screen needs a handful of counts, and fetching them as four separate
-- queries on every open is four round trips for four integers. One call returns
-- all of them.
--
-- Every number here is real. Nothing is padded to make the screen look busier
-- than the product is -- an invented count is the fastest way to lose the trust
-- this whole product is built on, and a new member seeing honest zeroes is
-- better served than one shown activity that is not there.

create or replace function public.home_summary()
returns table (
  introductions integer,
  new_connections integer,
  unread_conversations integer,
  interests_received integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.discover_members(10, 0)),
    (select count(*)::integer from public.my_conversations() c
      where c.last_message_at is null and c.ended_at is null),
    (select count(*)::integer from public.my_conversations() c where c.unread),
    (select public.interests_received_count());
$$;

revoke execute on function public.home_summary() from anon;
grant execute on function public.home_summary() to authenticated;
