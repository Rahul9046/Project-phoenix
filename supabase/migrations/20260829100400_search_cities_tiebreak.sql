-- Give same-named cities a deterministic order.
--
-- Udaipur exists in both Rajasthan and Tripura, Bilaspur in both Chhattisgarh
-- and Himachal Pradesh. The previous ordering ran out of tiebreakers and fell
-- back to physical row order, so which one appeared first was arbitrary and
-- could change after any bulk update.
--
-- State name is added as the last comparison. It is not a popularity ranking --
-- there is no population data here, and inventing one would be worse than
-- alphabetical -- but it is stable, and the state is displayed beside every
-- result precisely so the person can tell the two apart themselves.

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
    -- Orders results, never filters them. Every city stays selectable.
    c.is_launch_city desc,
    length(c.name),
    c.name,
    c.state
  limit greatest(1, least(coalesce(max_results, 8), 25));
$$;

grant execute on function public.search_cities(text, integer) to anon, authenticated;
