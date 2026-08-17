-- Languages a member speaks.
--
-- Note what is *not* here: "Prefer not to say" is not a language and is not a
-- row. Declining to answer is recorded as `profiles.languages_undisclosed`, so
-- an opt-out can never be mistaken for a spoken language when matching later.

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- BCP-47 where one exists, so the value means something outside Eraya.
  code text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.languages is
  'Selectable languages. Declining to answer is profiles.languages_undisclosed, not a row here.';

create index languages_active_order_idx
  on public.languages (is_active, sort_order);
