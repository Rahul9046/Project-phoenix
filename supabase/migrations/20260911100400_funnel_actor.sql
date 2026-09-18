-- Who the funnel events belong to.
--
-- `record_product_event` reads the actor from `auth.uid()`, which is right for
-- the clients that call it: there is no parameter for an identity, so a caller
-- cannot attribute an event to somebody else. Inside a trigger that same
-- decision quietly fails, and `actor` is nullable, so it fails by writing a row
-- nobody can be matched to rather than by raising anything.
--
-- `registration_started` was the worst case, and it was wrong in production
-- rather than only under the probe. A profile row is created by a trigger on
-- `auth.users`, which runs on GoTrue's own connection where there is no session
-- at all -- so every registration event would have landed with a null actor,
-- and "how many people who registered finished onboarding" would have been
-- unanswerable from a table that appeared to hold the answer.
--
-- These three triggers do not need to ask. `new.id` is the member whose profile
-- this is, and `new.sender_id` is the person who sent the message. They insert
-- directly and attribute explicitly, and keep the property that matters from
-- `record_product_event`: an exception here is swallowed, because none of these
-- transitions may fail on account of being counted.

create or replace function public.record_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.product_events (event, actor)
    values ('registration_started', new.id);
  exception
    when others then
      null;
  end;
  return new;
end;
$$;

create or replace function public.record_onboarding_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.onboarding_stage = 'onboarding_completed'
     and old.onboarding_stage is distinct from 'onboarding_completed' then
    begin
      insert into public.product_events (event, actor)
      values ('onboarding_completed', new.id);
    exception
      when others then
        null;
    end;
  end if;
  return new;
end;
$$;

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
    begin
      insert into public.product_events (event, actor)
      values ('conversation_started', new.sender_id);
    exception
      when others then
        null;
    end;
  end if;
  return new;
end;
$$;

comment on function public.record_registration() is
  'Records that an account reached the point of having a profile. Attributes to the new row, because no session exists when GoTrue creates it.';

comment on function public.record_onboarding_completed() is
  'Records the transition into a finished profile, once. Attributes to the profile rather than the caller, so a backfill cannot orphan the event.';

comment on function public.record_first_message() is
  'Records that a connection turned into a conversation, on the first message only. Never records what was said.';
