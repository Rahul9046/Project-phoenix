-- Let a misspelling still find the city.
--
-- The previous version matched with `search_terms like '%q%'`, which is exact
-- substring containment. It handles the common cases well -- "kolk", "bombay",
-- "madras", "cochin" all resolve -- but a single wrong letter fails completely:
-- "banglore" and "aizwal" both returned nothing, and someone who cannot spell
-- their own city in English is exactly the person this product should not turn
-- away at the first field.
--
-- The trigram index from 20260829100100 was created for this and never used.
-- The fallback only runs when the substring pass finds nothing, so the fast
-- path is untouched and ranking for normal queries is bit-for-bit identical.
--
-- Matching is by *word* similarity (`<%`), not plain similarity (`%`). Plain
-- similarity compares two whole strings, and `search_terms` is a long
-- concatenation -- "bengaluru bangalore bengalooru karnataka ka" -- so its
-- similarity to an eight-character query is near zero no matter how well one of
-- those words matches. `<%` asks the question that is actually being asked: does
-- some word in here look like what they typed?
--
-- The threshold is written out as a comparison rather than using the `<%`
-- operator, at 0.45 instead of the 0.6 default. 0.6 rejects "banglore",
-- "hydrabad" and "guwhati" -- the exact single-dropped-letter mistakes this is
-- for. 0.45 accepts them and still rejects nonsense. It costs the trigram index,
-- because a written-out comparison is not indexable, but this branch runs only
-- after the indexed pass has already found nothing, over 493 rows: the
-- alternative is showing someone an empty list.

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
language plpgsql
stable
set search_path = public
as $$
declare
  q text := lower(btrim(coalesce(query, '')));
  cap integer := greatest(1, least(coalesce(max_results, 8), 25));
begin
  return query
    select c.id, c.name, c.state, c.state_code, c.is_launch_city
    from public.cities c
    where c.is_active
      and (q = '' or c.search_terms like '%' || q || '%')
    order by
      case
        when q = '' then 4
        when lower(c.name) = q then 0
        when lower(c.name) like q || '%' then 1
        when c.search_terms like '% ' || q || '%' then 2
        else 3
      end,
      -- Orders results, never filters them. Every city stays selectable.
      c.is_launch_city desc,
      length(c.name),
      c.name,
      c.state
    limit cap;

  if found or q = '' then
    return;
  end if;

  -- Nothing contained the query. Try it as a misspelling.
  --
  -- Ranked by similarity to the name, so "banglore" reaches Bengaluru through
  -- its "bangalore" search term but is still ordered against the real names.
  return query
    select c.id, c.name, c.state, c.state_code, c.is_launch_city
    from public.cities c
    where c.is_active
      and word_similarity(q, c.search_terms) >= 0.45
    order by
      word_similarity(q, c.search_terms) desc,
      c.is_launch_city desc,
      length(c.name),
      c.name,
      c.state
    limit cap;
end;
$$;

grant execute on function public.search_cities(text, integer) to anon, authenticated;
