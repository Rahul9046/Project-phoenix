-- Interest, counted but never named.
--
-- The product decision this encodes: a member is told how many people have
-- expressed interest in them, and is never told who, by any means, at any tier.
--
-- That is a reversal. `interests_received()` existed to return exactly those
-- identities to a paying member, and `canSeeInteresters` was the entitlement
-- sold to unlock it. Both go. The reasoning is that knowing who has already
-- chosen you changes how you read their profile -- you are no longer deciding
-- whether you want them, you are deciding whether to accept being wanted, and
-- those are different questions. Eraya would rather each person choose without
-- that thumb on the scale, and a promise of privacy that premium can buy its way
-- past is not a promise.
--
-- Deleting the function rather than emptying it is deliberate. A function that
-- exists and returns nothing invites somebody to "fix" it later; one that is
-- gone has to be deliberately rebuilt, and whoever does that will read this.

-- ---------------------------------------------------------------------------
-- The identities, removed at the source
-- ---------------------------------------------------------------------------
--
-- Nothing else depends on it: `home_summary` counts through
-- `interests_received_count`, and no other function joins to it.

drop function if exists public.interests_received();

-- ---------------------------------------------------------------------------
-- The count, now with suspension
-- ---------------------------------------------------------------------------
--
-- This is the function from 20260830160400_discovery_v2.sql with two clauses
-- added, marked below. Everything else is unchanged: interest that has already
-- been reciprocated is excluded because it is a connection now rather than a
-- pending interest, blocks are excluded in both directions, and a member who
-- has not finished onboarding is not a person anyone should be counting.
--
-- Deletion needs no clause. `member_interests.from_id` cascades from
-- `auth.users`, so a deleted member's interest is gone rather than merely
-- hidden, which is the difference between being forgotten and being filtered.
--
-- Suspension does need one, and it was missing. A suspended member vanishes from
-- discovery in both directions (20260911100100_moderation.sql), and the count
-- has to agree with that or the product contradicts itself: a number that cannot
-- be explained by anything the member can see is worse than no number, because
-- the only available reading is that Eraya is padding it.
--
-- Recreated with `create or replace` rather than dropped: `home_summary` calls
-- this, and dropping it would take that function's body with it.

create or replace function public.interests_received_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.member_interests i
  join public.profiles p on p.id = i.from_id
  where i.to_id = auth.uid()
    and i.kind = 'interested'
    and p.onboarding_stage = 'onboarding_completed'
    -- Added: a suspended member is shown nobody, so they are shown no count
    -- of nobody either.
    and not exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.suspended_at is not null
    )
    -- Added: and a suspended member is counted by nobody.
    and p.suspended_at is null
    and not exists (
      select 1 from public.member_interests mine
      where mine.from_id = auth.uid() and mine.to_id = i.from_id
    )
    and not exists (
      select 1 from public.member_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = i.from_id)
         or (b.blocker_id = i.from_id and b.blocked_id = auth.uid())
    );
$$;

-- `create or replace` keeps existing privileges, but stating them is what makes
-- the rule checkable rather than inherited. `create function` grants EXECUTE to
-- PUBLIC and `anon` inherits it, so revoking from `anon` alone does nothing.
revoke execute on function public.interests_received_count() from public, anon;
grant execute on function public.interests_received_count() to authenticated;

comment on function public.interests_received_count() is
  'How many people have expressed interest in the caller and have not been reciprocated, blocked, suspended or deleted. The identities behind this number are not obtainable at any tier -- there is no function that returns them.';

-- ---------------------------------------------------------------------------
-- The entitlement that sold it
-- ---------------------------------------------------------------------------
--
-- Removed rather than set to false for both tiers. `loadTierComparison` builds
-- the public pricing table from whatever rows are here, so a lingering false/false
-- row would advertise a capability nobody can buy and nobody has. Premium keeps
-- what it had otherwise -- more reverts, incognito, priority visibility -- and
-- gains nothing invented to keep the list the same length.

delete from public.entitlements where key = 'canSeeInteresters';
