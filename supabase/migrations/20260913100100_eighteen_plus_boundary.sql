-- Eraya is 18+, on a boundary the clients and the database agree on.
--
-- The rule itself has not changed and is not changing here: a member must have
-- already reached their eighteenth birthday. There is one age for everybody --
-- no different number by gender -- and it was never a year subtraction, which
-- would call a seventeen-year-old an adult for most of the year.
--
-- What changes is which day "today" means.
--
-- `current_date` is read in the database's time zone, which is UTC. Both clients
-- compute their boundary from the device's local calendar, which for Eraya's
-- members is very nearly always IST. Those two disagree for the five and a half
-- hours after local midnight: during that window the UTC date is still
-- yesterday, so the constraint's boundary sits a day earlier than the picker's.
--
-- The person that costs is specific. Somebody whose eighteenth birthday is today,
-- filling the form at seven in the morning, is offered their own birth date by a
-- picker that believes they are eligible -- and then refused by Postgres, which
-- believes it is still the day before. They are eighteen. They are told to check
-- the year. There is nothing they can do about it except wait, and nothing on
-- the screen tells them that.
--
-- Reading the date in Asia/Kolkata puts the constraint on the same day as the
-- clients. It is deliberately the more generous of the two readings: where the
-- two could differ, the error that admits somebody on the morning of their
-- eighteenth birthday is better than the one that turns them away on it.
--
-- This is strictly wider than the constraint it replaces -- the IST date is
-- never behind the UTC one, so every birth date that satisfied the old check
-- satisfies this one. No existing profile can be invalidated by it, and none is
-- read or rewritten here.

alter table public.profiles
  drop constraint if exists profiles_date_of_birth_adult;

alter table public.profiles
  add constraint profiles_date_of_birth_adult
    check (
      date_of_birth is null
      or date_of_birth
           <= ((now() at time zone 'Asia/Kolkata')::date - interval '18 years')
    );

comment on constraint profiles_date_of_birth_adult on public.profiles is
  'Eraya is 18+. The member must already have reached their eighteenth birthday, read against the Indian calendar date so the constraint and both clients draw the line on the same day. Null until onboarding asks.';
