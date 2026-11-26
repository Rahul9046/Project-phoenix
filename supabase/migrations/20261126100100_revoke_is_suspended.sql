-- A member may not ask whether another member has been suspended.
--
-- Found on 2026-11-26, by the first runtime audit of what a member's token can
-- actually execute -- a question that needed a local database to ask, because
-- `has_function_privilege` depends on grants that only exist once the
-- migrations have been applied somewhere.
--
-- `is_suspended(p_profile uuid)` is `security definer` and answers about ANY
-- profile. It was never revoked, so `authenticated` kept the EXECUTE that
-- Supabase's default privileges hand out, and a signed-in member could ask it
-- about anybody whose id they had. Discovery hands out ids, so that is everyone
-- the product has ever shown them. Measured, not inferred: as an ordinary
-- member it answered `200 true` for a suspended member, and `anon` was already
-- refused.
--
-- Two reasons this matters more than a boolean looks.
--
-- Suspension is a moderation outcome. It follows reports, and disclosing it
-- tells a stranger that somebody was reported and acted upon -- which is the
-- reporter's business and the moderator's, not a third party's.
--
-- And it defeats the one disclosure the product is most careful about. A block
-- is never disclosed: a blocked member simply stops seeing the blocker, and is
-- told nothing. A suspended member also disappears from everyone's discovery.
-- Those two silences are deliberately identical from the outside -- and this
-- function told them apart, which hands somebody a way to work out that they
-- were blocked by a specific person rather than that the person was suspended.
--
-- Nothing calls it. Not a policy, not another function, not a view, not either
-- client -- it appears in the generated database types and nowhere else. The
-- product checks `suspended_at is not null` inline everywhere it cares, which
-- is why this went unnoticed: the function is dead code with a live grant.
--
-- So the fix is the whole fix, and it is the repository's own rule, applied to
-- the one function that had escaped it: revoke from `public` -- not from `anon`,
-- which inherits PUBLIC's grant and so cannot be revoked from directly -- and
-- grant to nobody. The service role keeps EXECUTE through its own default
-- privilege, as it does for every other function meant for the server alone.

revoke execute on function public.is_suspended(uuid) from public, anon, authenticated;

comment on function public.is_suspended(uuid) is
  'Whether this profile is suspended. Server-side only: a member learning this about another member would be told a moderation outcome, and could tell a suspension apart from a block. Revoked from public, anon and authenticated 2026-11-26.';
