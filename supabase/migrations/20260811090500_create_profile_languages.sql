-- Which languages a member speaks.

create table public.profile_languages (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- The pair is the identity of the row; a language cannot be listed twice.
  primary key (profile_id, language_id)
);

comment on table public.profile_languages is
  'Languages a member speaks. Absence plus profiles.languages_undisclosed means they declined.';

-- The primary key already covers lookups by profile; this covers the reverse,
-- for "who speaks Mizo in Aizawl" style queries once discovery exists.
create index profile_languages_language_id_idx
  on public.profile_languages (language_id);
