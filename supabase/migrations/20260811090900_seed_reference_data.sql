-- Reference data.
--
-- Seeded in a migration rather than seed.sql because production needs it too —
-- signup cannot render without cities. Written as idempotent upserts on the
-- natural key so re-running is safe and later migrations can amend the list.

-- The seven cities Eraya opens in. Bengaluru is deliberately not among them.
-- Anyone elsewhere still registers; their city is free text on the profile.
insert into public.cities (name, slug, is_launch_city, sort_order, is_active)
values
  ('Hyderabad', 'hyderabad', true, 10, true),
  ('Delhi',     'delhi',     true, 20, true),
  ('Kolkata',   'kolkata',   true, 30, true),
  ('Mumbai',    'mumbai',    true, 40, true),
  ('Pune',      'pune',      true, 50, true),
  ('Aizawl',    'aizawl',    true, 60, true),
  ('Chennai',   'chennai',   true, 70, true)
on conflict (slug) do update
  set name           = excluded.name,
      is_launch_city = excluded.is_launch_city,
      sort_order     = excluded.sort_order,
      is_active      = excluded.is_active;

-- Languages offered at onboarding, in the order they are shown.
-- "Prefer not to say" is not here: see profiles.languages_undisclosed.
insert into public.languages (name, code, sort_order, is_active)
values
  ('English',   'en', 10,  true),
  ('Hindi',     'hi', 20,  true),
  ('Bengali',   'bn', 30,  true),
  ('Telugu',    'te', 40,  true),
  ('Tamil',     'ta', 50,  true),
  ('Marathi',   'mr', 60,  true),
  ('Malayalam', 'ml', 70,  true),
  ('Kannada',   'kn', 80,  true),
  ('Gujarati',  'gu', 90,  true),
  ('Punjabi',   'pa', 100, true),
  ('Urdu',      'ur', 110, true),
  ('Mizo',      'lus', 120, true),
  ('Odia',      'or', 130, true),
  ('Assamese',  'as', 140, true)
on conflict (code) do update
  set name       = excluded.name,
      sort_order = excluded.sort_order,
      is_active  = excluded.is_active;
