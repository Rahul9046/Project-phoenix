-- Close the member-facing functions to anonymous callers, properly.
--
-- A security probe found `discover_members` answering an unauthenticated
-- request. So were `home_summary`, `my_conversations`, `interests_received_count`,
-- `reverts_remaining` and -- worst of the set, because it writes --
-- `mark_conversation_read`.
--
-- The cause is a Postgres default that is easy to miss: `create function` grants
-- EXECUTE to PUBLIC, and `anon` is a member of PUBLIC. The earlier migrations
-- wrote `revoke execute ... from anon`, which removes a grant `anon` never
-- separately held and leaves the inherited one untouched. Revoking from PUBLIC
-- is what actually closes the door; the original `restrict_function_execute`
-- migration got this right and the newer ones did not copy it.
--
-- No data was exposed. Every one of these compares against `auth.uid()`, which
-- is null for an anonymous caller, so each returned an empty result. That is the
-- shape of the queries protecting them rather than the permissions, and it is
-- exactly the kind of accidental safety that stops being safe the first time
-- somebody adds a left join. `mark_conversation_read` had no such excuse: it is
-- an UPDATE, reachable without a session, and only the `me in (member_a,
-- member_b)` predicate kept it inert.
--
-- The lesson for future migrations: revoke from `public`, then grant to
-- `authenticated`. Revoking from `anon` alone does nothing.

revoke execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  from public, anon;

revoke execute on function public.home_summary() from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.interests_received() from public, anon;
revoke execute on function public.interests_received_count() from public, anon;
revoke execute on function public.reverts_remaining() from public, anon;
revoke execute on function public.revert_last_pass() from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
revoke execute on function public.member_profile(uuid) from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
revoke execute on function public.enforce_photo_limit() from public, anon, authenticated;

grant execute on function
  public.discover_members(integer, integer, integer, integer, uuid[], uuid[], public.relationship_status[])
  to authenticated;

grant execute on function public.home_summary() to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.interests_received() to authenticated;
grant execute on function public.interests_received_count() to authenticated;
grant execute on function public.reverts_remaining() to authenticated;
grant execute on function public.revert_last_pass() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.member_profile(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- These two stay open. Onboarding needs to search cities and the landing page
-- needs the coverage count, both before anyone has signed in, and neither
-- touches a member.
grant execute on function public.search_cities(text, integer) to anon, authenticated;
grant execute on function public.city_coverage() to anon, authenticated;
