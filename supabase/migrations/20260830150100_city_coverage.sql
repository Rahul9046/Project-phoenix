-- How much of India is actually available.
--
-- The landing page used to show a list of seven "launch cities" under the
-- heading "Where the community is densest". Both halves were wrong: the list
-- came from a hardcoded `is_launch_city` seed flag rather than from where
-- members are, and there is no membership density to report yet. It also read
-- as a restriction on a page that says anyone in India can join.
--
-- What the page can honestly say is how many places are selectable, so this
-- returns exactly that -- counted at read time, so the number cannot drift from
-- the table the way a hardcoded one would.
--
-- `stable`, not `volatile`: it reads and never writes, so PostgREST is free to
-- reuse the plan.

create or replace function public.city_coverage()
returns table (city_count integer, state_count integer)
language sql
stable
set search_path = public
as $$
  select
    count(*)::integer,
    count(distinct state)::integer
  from public.cities
  where is_active;
$$;

comment on function public.city_coverage() is
  'Count of selectable cities and the states they span, for public marketing copy.';

grant execute on function public.city_coverage() to anon, authenticated;
