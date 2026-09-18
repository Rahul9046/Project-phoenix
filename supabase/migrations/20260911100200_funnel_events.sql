-- The funnel before the paywall.
--
-- `product_events` existed and only payments used it, so every question about
-- the product answered itself from the last step backwards: how many people
-- bought, and nothing about how many got close. Whether people finish
-- onboarding, whether discovery leads anywhere, whether interest becomes a
-- conversation -- none of it was measurable.
--
-- These are recorded inside the functions that already perform each transition,
-- not from the clients. Three reasons, and the third is the important one:
--
--   The clients cannot double-count. A component that re-renders fires no
--   event, because the event belongs to the database write, not the screen.
--
--   Web and mobile cannot drift. One definition of "expressed interest", not
--   two that diverge the first time someone edits a screen.
--
--   Nothing personal can be attached by accident. `record_product_event` takes
--   an event name and payment fields and reads the actor from the session --
--   there is no parameter for a message, a name, a number or a date of birth,
--   so none can be passed.
--
-- Deliberately no event for reading a message or opening a thread. Counting how
-- often somebody reads their own conversations is surveillance of the private
-- part of the product, and the funnel does not need it: `conversation_started`
-- already says the connection turned into talking.

-- ---------------------------------------------------------------------------
-- Interest, and the connection it may become
-- ---------------------------------------------------------------------------
--
-- Unchanged from the moderation migration except for the two record calls.

create or replace function public.express_interest(
  target_id uuid,
  decision public.interest_kind default 'interested'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  reciprocated boolean;
  connection uuid;
begin
  if me is null or me = target_id then
    raise exception 'invalid target';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id in (me, target_id) and p.suspended_at is not null
  ) then
    raise exception 'unavailable';
  end if;

  if exists (
    select 1 from public.member_blocks b
    where (b.blocker_id = me and b.blocked_id = target_id)
       or (b.blocker_id = target_id and b.blocked_id = me)
  ) then
    raise exception 'unavailable';
  end if;

  insert into public.member_interests (from_id, to_id, kind)
  values (me, target_id, decision)
  on conflict (from_id, to_id) do update set kind = excluded.kind;

  if decision <> 'interested' then
    return null;
  end if;

  -- Only the positive decision is an event. Passing on someone is a private
  -- act and counting it would turn discovery into a scored experience.
  perform public.record_product_event('interest_expressed');

  select exists (
    select 1 from public.member_interests i
    where i.from_id = target_id and i.to_id = me and i.kind = 'interested'
  ) into reciprocated;

  if not reciprocated then
    return null;
  end if;

  insert into public.connections (member_a, member_b)
  values (least(me, target_id), greatest(me, target_id))
  on conflict (member_a, member_b) do update set ended_at = null, ended_by = null
  returning id into connection;

  perform public.record_product_event('connection_created');

  return connection;
end;
$$;

comment on function public.express_interest(uuid, public.interest_kind) is
  'Records a decision and opens a connection when it is mutual. Atomic, so a race cannot create two. Refuses when either side is suspended.';

revoke execute on function public.express_interest(uuid, public.interest_kind) from public, anon;
grant execute on function public.express_interest(uuid, public.interest_kind) to authenticated;

-- ---------------------------------------------------------------------------
-- The first message in a connection
-- ---------------------------------------------------------------------------
--
-- A trigger rather than a call inside a function, because messages are inserted
-- directly under an RLS policy and there is no function to put it in. It fires
-- only for the first message in a connection: "they started talking" is the
-- funnel step, and one event per message would be both noise and a rough count
-- of how much two people are saying to each other.

create or replace function public.record_first_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.messages m
    where m.connection_id = new.connection_id and m.id <> new.id
  ) then
    perform public.record_product_event('conversation_started');
  end if;
  return new;
end;
$$;

drop trigger if exists messages_first_message_event on public.messages;
create trigger messages_first_message_event
  after insert on public.messages
  for each row execute function public.record_first_message();

-- ---------------------------------------------------------------------------
-- Finishing onboarding
-- ---------------------------------------------------------------------------
--
-- A trigger on the transition rather than on the column, so re-saving a
-- completed profile records nothing. Both clients write this stage through
-- ordinary updates, so there is no single function to hook.

create or replace function public.record_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.onboarding_stage = 'onboarding_completed'
     and old.onboarding_stage is distinct from 'onboarding_completed' then
    perform public.record_product_event('onboarding_completed');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_onboarding_completed_event on public.profiles;
create trigger profiles_onboarding_completed_event
  after update of onboarding_stage on public.profiles
  for each row execute function public.record_onboarding_completed();

-- A profile row appearing is the first thing that happens after an account is
-- confirmed, which makes it the honest marker for "someone started".
create or replace function public.record_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.record_product_event('registration_started');
  return new;
end;
$$;

drop trigger if exists profiles_registration_event on public.profiles;
create trigger profiles_registration_event
  after insert on public.profiles
  for each row execute function public.record_registration();

-- ---------------------------------------------------------------------------
-- Looking
-- ---------------------------------------------------------------------------
--
-- `discovery_viewed` fires once per fetch of the list, not once per render, and
-- `profile_viewed` once per full profile opened. Both live inside the functions
-- the clients already call, so paging counts as a view and scrolling does not.

create or replace function public.record_discovery_view()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  select public.record_product_event('discovery_viewed');
$$;

revoke execute on function public.record_discovery_view() from public, anon;
grant execute on function public.record_discovery_view() to authenticated;

comment on function public.record_discovery_view() is
  'Called by the clients when a page of discovery is fetched. Separate from discover_members because that function is STABLE and cannot write.';

create or replace function public.record_profile_view()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  select public.record_product_event('profile_viewed');
$$;

revoke execute on function public.record_profile_view() from public, anon;
grant execute on function public.record_profile_view() to authenticated;

comment on function public.record_profile_view() is
  'Called by the clients when a full member profile is opened. Records that a profile was viewed, never which one.';

