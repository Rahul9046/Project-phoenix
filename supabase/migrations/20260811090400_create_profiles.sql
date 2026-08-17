-- Member profiles.
--
-- Identity stays in auth.users; everything the product knows about a person
-- lives here, keyed by the same id. One row per account, created automatically
-- on signup (see the trigger migration) so no code path ever has to cope with a
-- signed-in user who has no profile.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Collected at onboarding. Nullable because a profile exists from the moment
  -- the account does, before any of it has been answered.
  first_name text,
  date_of_birth date,
  gender public.gender,

  -- One of the listed cities...
  city_id uuid references public.cities (id) on delete set null,
  -- ...or anywhere else, named freely. Never a reason to refuse an account.
  other_city text,

  relationship_status public.relationship_status,

  -- True when the person chose not to disclose their languages, which is
  -- different from having answered nothing yet.
  languages_undisclosed boolean not null default false,

  onboarding_stage public.onboarding_stage not null default 'authenticated',

  -- Mirrored from auth.users.phone_confirmed_at by trigger once real SMS
  -- verification is live. Written directly by the mocked flow until then.
  phone_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A name is either given or absent, never blank.
  constraint profiles_first_name_not_blank
    check (first_name is null or length(btrim(first_name)) > 0),
  constraint profiles_other_city_not_blank
    check (other_city is null or length(btrim(other_city)) > 0),
  -- Eraya is 18+. Enforced here so it cannot be bypassed by calling the API
  -- directly, and generously (no upper bound worth guessing at).
  constraint profiles_date_of_birth_adult
    check (date_of_birth is null or date_of_birth <= (current_date - interval '18 years'))
);

comment on table public.profiles is
  'One row per account, created on signup. Product data only; credentials stay in auth.users.';

create index profiles_city_id_idx on public.profiles (city_id);
create index profiles_onboarding_stage_idx on public.profiles (onboarding_stage);
