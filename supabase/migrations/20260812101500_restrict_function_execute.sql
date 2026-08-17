-- Stop the trigger functions being callable as API endpoints.
--
-- Anything in `public` is exposed by PostgREST as `/rest/v1/rpc/<name>`, so
-- these were reachable by `anon`. Two of them are `SECURITY DEFINER`, which
-- means they run with the definer's rights — exactly the combination Supabase's
-- security linter flags, and rightly: a definer function that any visitor can
-- invoke is a privilege-escalation surface waiting for a future edit to make it
-- exploitable.
--
-- Revoking EXECUTE does not affect the triggers. PostgreSQL checks privileges
-- on a trigger function when the trigger is created, not each time it fires, so
-- signup still creates a profile and `updated_at` still updates.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_phone_verified_at() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
