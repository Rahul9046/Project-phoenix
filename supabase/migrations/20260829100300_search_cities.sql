-- Ranked city search.
--
-- A plain ILIKE returns matches in no meaningful order: typing "kol" surfaces
-- Akola above Kolkata because the database has no opinion about which the person
-- meant. Ranking has to happen somewhere, and it belongs here rather than in the
-- application — the alternative is fetching a large unordered set over the
-- network and sorting it in the browser.
--
-- The order is: exact name, then name-prefix, then a word inside the name, then
-- anything in search_terms (which is where alternative spellings live, so
-- "bangalore" still finds Bengaluru — just below anything literally starting
-- with those letters).

create or replace function public.search_cities(
  query text,
  max_results integer default 8
)
returns table (
  id uuid,
  name text,
  state text,
  state_code text,
  is_launch_city boolean
)
language sql
stable
-- SECURITY INVOKER (the default): the caller's RLS still applies, so this
-- exposes exactly what a direct select would. It is a convenience, not a
-- privilege escalation.
set search_path = public
as $$
  with needle as (
    select lower(btrim(coalesce(query, ''))) as q
  )
  select
    c.id,
    c.name,
    c.state,
    c.state_code,
    c.is_launch_city
  from public.cities c, needle n
  where c.is_active
    and (n.q = '' or c.search_terms like '%' || n.q || '%')
  order by
    case
      when n.q = '' then 4
      when lower(c.name) = n.q then 0
      when lower(c.name) like n.q || '%' then 1
      when c.search_terms like '% ' || n.q || '%' then 2
      else 3
    end,
    -- Within a rank, the focus cities first: they are where Eraya's community is
    -- densest, so they are the likelier intent. This orders results; it never
    -- filters them, and every other city remains equally selectable.
    c.is_launch_city desc,
    length(c.name),
    c.name
  limit greatest(1, least(coalesce(max_results, 8), 25));
$$;

comment on function public.search_cities(text, integer) is
  'Ranked city search for the onboarding selector. Ordering only — never filters by availability.';

-- Readable by signed-out visitors too: the landing page form offers city
-- selection before anyone has an account.
grant execute on function public.search_cities(text, integer) to anon, authenticated;
