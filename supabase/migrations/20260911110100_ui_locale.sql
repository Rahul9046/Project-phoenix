-- The language Eraya speaks to a member in.
--
-- Not the same thing as `profile_languages`, and the distance between them is
-- the whole reason this column is named the way it is. That table is the
-- languages a member *speaks*: profile data, shown to other members, used by
-- discovery to introduce people who can actually talk to each other. This is
-- only which translation of Eraya's own words a person reads. Changing it
-- changes nothing another member sees and nothing about who is introduced to
-- whom.
--
-- Stored on the profile rather than in local storage alone so the choice
-- follows a member between their phone and a browser. Somebody who set the app
-- to Tamil and then opened the website to an English page would reasonably
-- conclude the setting had not saved.
--
-- The check constraint is the list of translations that exist. A locale the
-- product cannot render is not a preference, it is a blank screen -- and the
-- clients fall back to English for an unknown value, which would make a bad
-- write look like the setting being ignored.

alter table public.profiles
  add column if not exists ui_locale text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_ui_locale_known;

alter table public.profiles
  add constraint profiles_ui_locale_known
    check (ui_locale in ('en', 'hi', 'bn', 'mr', 'te', 'ta'));

comment on column public.profiles.ui_locale is
  'Which translation of Eraya''s interface this member reads. Not their spoken languages -- see profile_languages -- and never shown to another member.';
