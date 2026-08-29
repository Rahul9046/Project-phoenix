-- Eraya opens across all of India.
--
-- The previous model had seven launch cities and treated everywhere else as a
-- fallback: `is_launch_city` marked availability, and a member outside the list
-- was stored as free text against a null `city_id`. That is now obsolete.
-- Registration is open everywhere in India, and every member should resolve to a
-- real row in this table so discovery can later reason about distance.
--
-- `is_launch_city` is kept, but its meaning changes. It is marketing and
-- community-density metadata — where Eraya is concentrating first — and it MUST
-- NOT gate registration anywhere in the application.

alter table public.cities
  -- Which state or union territory. Shown beside the name so two cities called
  -- Hyderabad, or the several places called Aurangabad, can be told apart.
  add column if not exists state text,
  -- The short code, for compact display and future grouping.
  add column if not exists state_code text,
  -- Always 'IN' for now. Stored rather than assumed so the day Eraya opens
  -- elsewhere is a data change, not a schema change — but no country selector is
  -- shown to anyone, because there is nothing to choose between.
  add column if not exists country_code text not null default 'IN',
  -- Lowercased, unpunctuated, unaccented form of the name, plus common
  -- alternatives. This is what search matches against, so someone typing
  -- "bangalore" finds Bengaluru and "gurgaon" finds Gurugram.
  add column if not exists search_terms text,
  -- Nullable on purpose. Populated for the cities where the value is known and
  -- correct; a guessed coordinate is worse than an absent one, because a wrong
  -- distance is indistinguishable from a right one at a glance.
  add column if not exists latitude numeric(8, 5),
  add column if not exists longitude numeric(8, 5);

comment on column public.cities.is_launch_city is
  'Marketing/community-density metadata only. Never gates registration.';
comment on column public.cities.search_terms is
  'Lowercased name, state and known alternative spellings. What search matches on.';
comment on column public.cities.latitude is
  'Null where not verified. A guessed coordinate is worse than none.';

comment on table public.cities is
  'Every city in India offered at signup. Registration is never restricted by city.';

-- Search runs an unanchored ILIKE, which cannot use a b-tree index. Trigrams
-- can, and they also make near-misses cheap, which matters because people
-- misspell city names constantly.
create extension if not exists pg_trgm;

create index if not exists cities_search_terms_trgm_idx
  on public.cities using gin (search_terms gin_trgm_ops);

-- Ordering for the unsearched list: the focus cities first, then alphabetically.
create index if not exists cities_active_name_idx
  on public.cities (is_active, name);
