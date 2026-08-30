-- Interest, connection, conversation — and the ability to stop both.
--
-- Until now Eraya had no way for one member to reach another, and the RLS
-- migration said so plainly: cross-member discovery was absent because the rules
-- for who may see whom did not exist. They exist now, and this is them.
--
-- The shape is deliberate. Nobody can message anybody. Interest is expressed
-- privately, a conversation opens only when it is returned, and either person
-- can end it. That is the whole difference between this and an inbox anyone can
-- shout into.

-- ---------------------------------------------------------------------------
-- Blocks. First, because everything else has to respect them.
-- ---------------------------------------------------------------------------
create table public.member_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint member_blocks_not_self check (blocker_id <> blocked_id)
);

comment on table public.member_blocks is
  'One-directional. Blocking hides both people from each other; the block itself is never disclosed to the blocked person.';

create index member_blocks_blocked_idx on public.member_blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- Interest.
--
-- Private by design: expressing interest tells the other person nothing until
-- they express it back. Nobody learns they have been passed over, and nobody
-- can be pestered. "Not for me" is recorded as a pass so the same face does not
-- return tomorrow.
-- ---------------------------------------------------------------------------
create type public.interest_kind as enum ('interested', 'passed');

create table public.member_interests (
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  kind public.interest_kind not null,
  created_at timestamptz not null default now(),

  primary key (from_id, to_id),
  constraint member_interests_not_self check (from_id <> to_id)
);

comment on table public.member_interests is
  'One row per decision. A pass is stored so discovery does not offer the same person repeatedly.';

create index member_interests_to_idx on public.member_interests (to_id, kind);

-- ---------------------------------------------------------------------------
-- Connections.
--
-- Created only when interest is mutual. The pair is stored with the smaller uuid
-- first so a connection cannot exist twice under two orderings -- the usual bug
-- in symmetric relationships, and one that produces two conversations between
-- the same two people.
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references public.profiles (id) on delete cascade,
  member_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Set when either person ends it. The row stays: the conversation it held is
  -- part of what happened, and deleting it would rewrite that.
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete set null,

  constraint connections_ordered check (member_a < member_b),
  constraint connections_unique unique (member_a, member_b)
);

comment on table public.connections is
  'A mutual connection. member_a < member_b so the same pair cannot connect twice.';

create index connections_member_a_idx on public.connections (member_a);
create index connections_member_b_idx on public.connections (member_b);

-- ---------------------------------------------------------------------------
-- Messages.
--
-- No read receipts, no typing indicators, no delivered-at. Those exist to create
-- pressure -- to make someone feel watched, or owed a reply -- and Eraya's
-- audience is people rebuilding after something hard. read_at is deliberately
-- absent rather than present-and-unused: a column invites a feature.
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),

  constraint messages_body_not_blank check (length(btrim(body)) > 0),
  constraint messages_body_length check (length(body) <= 4000)
);

create index messages_connection_idx on public.messages (connection_id, created_at);

-- ---------------------------------------------------------------------------
-- Reports. Read by a person, which is a promise the product makes out loud.
-- ---------------------------------------------------------------------------
create table public.member_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,

  constraint member_reports_not_self check (reporter_id <> reported_id),
  constraint member_reports_reason_not_blank check (length(btrim(reason)) > 0)
);

create index member_reports_unreviewed_idx
  on public.member_reports (created_at) where reviewed_at is null;
