-- Cities Eraya operates in.
--
-- A table rather than a constant in the codebase: where Eraya is available will
-- change often, and changing it should not require a deploy.
--
-- `is_launch_city` gates *availability*, never *registration*. Someone outside
-- these cities can still create an account — their city is recorded as free
-- text on the profile and they hear from us when we reach them.

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_launch_city boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.cities is
  'Cities offered at signup. is_launch_city marks full availability; it never blocks registration.';

-- The city list is read on every signup and ordered for display.
create index cities_active_order_idx
  on public.cities (is_active, sort_order);
