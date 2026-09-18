-- Which version of the documents a member agreed to, and when.
--
-- Eraya asks for agreement the way most products do: a line under the sign-in
-- form saying that continuing means accepting the Terms and the Privacy Policy,
-- with both linked and readable before anybody has an account. There is no
-- checkbox. A checkbox on the screen that also creates the account is a second
-- tap for no additional consent, and a pre-ticked one is not consent at all.
--
-- What that arrangement does not do by itself is leave a record. "They must
-- have seen it, the line has always been there" is an argument, not evidence,
-- and the question anyone actually asks later -- a member, a regulator, a
-- payment provider -- is which wording was in front of that person on that day.
--
-- So two columns, and deliberately only two.
--
-- Null is the honest value for everybody who signed up before this existed, and
-- it stays null rather than being backfilled with a version they were never
-- shown. Backfilling would manufacture exactly the evidence this is meant to
-- record, which is worse than having none.
--
-- Written once, when onboarding completes: the first moment a member has both
-- passed the sign-in screen carrying the notice and finished setting up an
-- account. Recording it at the sign-in screen itself would capture people who
-- abandoned signup, and recording it on every request would be a write per page
-- view to store a value that does not change.

alter table public.profiles
  add column if not exists legal_version_accepted text,
  add column if not exists legal_accepted_at timestamptz;

comment on column public.profiles.legal_version_accepted is
  'The LEGAL_VERSION from @eraya/legal that was in force when this member finished onboarding. Null for accounts created before acceptance was recorded, and deliberately not backfilled.';

comment on column public.profiles.legal_accepted_at is
  'When legal_version_accepted was recorded.';

-- A version string is either a version or absent, never an empty string.
alter table public.profiles
  drop constraint if exists profiles_legal_version_not_blank;

alter table public.profiles
  add constraint profiles_legal_version_not_blank
    check (
      legal_version_accepted is null
      or length(btrim(legal_version_accepted)) > 0
    );

-- No new policy. `profiles` already lets a member write their own row and
-- nobody else's, which is exactly the reach this needs; adding a policy here
-- would widen a boundary that is currently correct.
