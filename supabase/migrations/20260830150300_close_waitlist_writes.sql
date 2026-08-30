-- Close the waitlist to public writes.
--
-- "Anyone can join the waitlist" let `anon` insert, which was correct while an
-- unauthenticated form on the landing page needed to. That form is gone --
-- registration is open across India, so collecting an address in order to tell
-- someone when they can join no longer means anything -- and an insert policy
-- with no caller is not neutral. It is an unauthenticated write endpoint that
-- nothing in the product uses and nothing watches, which is how a table fills
-- with junk.
--
-- The table and its rows stay. Dropping a table to tidy a landing page is the
-- wrong trade, and a waitlist may yet be wanted for something specific -- a
-- feature, an event, a city. Restoring it is one `create policy` away.
--
-- There is still no select policy, so the contents remain unreadable without the
-- service role. That was true before this migration and is unchanged by it.

drop policy if exists "Anyone can join the waitlist" on public.waitlist;

comment on table public.waitlist is
  'Retired. Kept for its rows and for possible future use; no policy grants any client access. Reachable only with the service role.';
