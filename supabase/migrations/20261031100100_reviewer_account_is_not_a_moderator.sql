-- Take tech@eraya.app off the moderation allowlist.
--
-- `tech@eraya.app` is becoming the dedicated account Google Play reviewers sign
-- into for closed testing. It was also one of the two addresses in
-- `ops_config.moderation_admins`, which `is_moderator()` reads to decide
-- moderation privilege -- so handing its password to Play review would have
-- handed an unknown third party the ability to read reports and suspend
-- members.
--
-- That is not a reviewer's job and not a risk worth taking for it. A reviewer
-- needs to see what a member sees: discovery, a profile, interest, settings,
-- the legal screens, six languages. None of that needs privilege, and the whole
-- point of the account is that it looks like an ordinary onboarded member.
--
-- Why this is a migration rather than a dashboard edit, or a bare UPDATE:
-- `20260911100100_moderation.sql` seeds this row with
-- `on conflict do update set value = excluded.value`, so any replay of that
-- migration -- a `db reset`, a new project, a restore -- puts the address back.
-- A change made only in the live row would be silently undone, and nobody would
-- find out until a reviewer could suspend somebody. Written here, the removal
-- travels with the schema.
--
-- `rahul@eraya.app` stays. The allowlist is keyed by email and compared against
-- the caller's verified session email, so this is the whole of the change: no
-- grant moves, no policy changes, and the account keeps every ordinary member
-- capability it had.
--
-- To give it back, add the address to this list in a new migration. Do not edit
-- this one -- the point of the file is that the state is readable in history.

insert into public.ops_config (key, value)
values ('moderation_admins', '["rahul@eraya.app"]'::jsonb)
on conflict (key) do update
   set value = excluded.value,
       updated_at = now();

comment on function public.is_moderator() is
  'True when the caller''s verified session email is on the ops_config allowlist. The one place moderation privilege is decided. tech@eraya.app was removed 2026-10-31: it is the Google Play reviewer account and must not carry privilege.';
