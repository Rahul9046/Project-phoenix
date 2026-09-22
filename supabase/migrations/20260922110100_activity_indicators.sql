-- Knowing there is something waiting, without opening anything.
--
-- Two questions a member should be able to answer from the navigation alone:
-- has anybody new chosen me back, and is anybody waiting on a reply. Both were
-- already answerable from data this schema holds; neither had a durable answer
-- to "and have you looked at it yet".
--
-- What is deliberately not here is a counter. There is no `unread_count` column
-- incremented on insert and decremented on read -- that is a second copy of a
-- fact the messages table already holds, and the copy is the one that ends up
-- wrong. Every number below is derived at read time from the rows themselves,
-- so a badge cannot drift from what is actually there, and cannot survive the
-- thing it was counting being deleted.

-- ---------------------------------------------------------------------------
-- Have you looked at your connections?
-- ---------------------------------------------------------------------------
--
-- One timestamp per member, not one flag per connection.
--
-- Per-connection state would be the obvious shape and it buys nothing here:
-- the product marks them seen all at once, because the screen shows them all at
-- once. A watermark answers "created since you last looked" exactly, survives
-- sign-out, and is the same answer on every device -- which a per-device
-- timestamp in localStorage or AsyncStorage could never be, and which is why
-- this is a column rather than client state.
--
-- Null means never looked, which is correct for an account that has just been
-- made: everything is new to somebody who has not been to the screen.

alter table public.profiles
  add column if not exists connections_seen_at timestamptz;

comment on column public.profiles.connections_seen_at is
  'When this member last opened their Connections list. A watermark: connections made after it are new to them. Never disclosed to anybody else, and never a claim about whether they read anything.';

/*
 * Written by the server's clock, not the client's.
 *
 * The column is the member's own row and RLS already lets them update it, so
 * this function is not a permission boundary -- it is a correctness one. A
 * client sending its own timestamp can send one from next year, and a watermark
 * in the future silently suppresses the badge for every connection they ever
 * make afterwards. `now()` here cannot be wrong, and the failure mode of a
 * wrong device clock stops at the device.
 */
create or replace function public.mark_connections_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set connections_seen_at = now()
   where id = auth.uid();
$$;

comment on function public.mark_connections_seen() is
  'Records that the caller has opened their Connections list. Writes only the caller''s own row, with the server''s clock.';

revoke execute on function public.mark_connections_seen() from public, anon;
grant execute on function public.mark_connections_seen() to authenticated;

-- ---------------------------------------------------------------------------
-- The numbers on the navigation
-- ---------------------------------------------------------------------------
--
-- Built on `my_conversations()` rather than beside it, which is the whole point
-- of doing this in SQL at all. That function already decides three things this
-- one must not decide differently:
--
--   who counts as a visible connection -- it drops any row whose other member
--   `member_profile` will not return, which is how a blocked person and a
--   deleted account disappear from here without a word about blocking in this
--   file. A badge for a conversation the member can no longer open is the exact
--   phantom this reuse prevents;
--
--   what unread means -- newest message is theirs, and arrived after this
--   member's own marker. Never your own message, because the sender is not
--   waiting on themselves;
--
--   and whose marker is read -- the caller's, never the other person's. Nothing
--   here can tell anybody when somebody else last opened a conversation.
--
-- The only thing added is the connection's `created_at`, which the inbox row
-- does not carry, joined back by id. Re-deriving any of the above would be a
-- second implementation of a safety rule, and the copy that drifts is always
-- the one nobody is looking at.

create or replace function public.activity_summary()
returns table (
  new_connections integer,
  unread_conversations integer,
  connections_needing_attention integer
)
language sql
stable
security definer
set search_path = public
as $$
  with seen as (
    select coalesce(p.connections_seen_at, '-infinity'::timestamptz) as since
      from public.profiles p
     where p.id = auth.uid()
  ),
  attention as (
    select
      -- New to them: made since they last looked, and still open. An ended
      -- connection is not news, whenever it was made.
      c.created_at > seen.since and conv.ended_at is null as is_new,
      conv.unread as is_unread
    from public.my_conversations() conv
    join public.connections c on c.id = conv.connection_id
    cross join seen
  )
  select
    count(*) filter (where is_new)::integer,
    -- Conversations, not messages. Eight messages from one person is one
    -- conversation wanting an answer; the count a member can act on is how many
    -- people are waiting, and a number that climbs with every message is a
    -- pressure gauge rather than a signal.
    count(*) filter (where is_unread)::integer,
    -- What the web needs. It has four destinations and conversations live
    -- inside Connections, so one badge has to speak for both -- a union rather
    -- than a sum, so a brand-new connection that has already said something is
    -- one thing to look at and not two.
    count(*) filter (where is_new or is_unread)::integer
  from attention;
$$;

comment on function public.activity_summary() is
  'New connections and conversations with unread messages, for the caller only. Derived from the rows themselves -- no stored counters. Discloses nothing about anybody else''s reading.';

revoke execute on function public.activity_summary() from public, anon;
grant execute on function public.activity_summary() to authenticated;
