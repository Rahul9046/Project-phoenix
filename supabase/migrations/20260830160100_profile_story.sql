-- What a person can say about themselves.
--
-- A profile is currently a set of facts: name, age, city, chapter, languages.
-- That is enough to be introduced but not enough to be understood, and a
-- discovery screen built on facts alone reduces people to rows in a table --
-- which is the specific thing Eraya must not do.
--
-- Two optional free-text fields, and no more. The temptation with a profile is
-- to keep adding prompts until it becomes a form, and a form is what people
-- abandon halfway. One question about who they are and one about what they hope
-- for covers the ground that matters; anything else can be said in a
-- conversation, which is the point of the product.
--
-- Both are nullable and neither gates onboarding. Someone who does not want to
-- write anything still has a complete, usable profile.

alter table public.profiles
  add column about text,
  add column looking_for text;

-- Long enough for a few honest paragraphs, short enough that the discovery card
-- never has to truncate something essential.
alter table public.profiles
  add constraint profiles_about_length
    check (about is null or length(about) <= 1200),
  add constraint profiles_looking_for_length
    check (looking_for is null or length(looking_for) <= 600);

comment on column public.profiles.about is
  'Optional. A few lines in the member''s own words, shown on their profile.';
comment on column public.profiles.looking_for is
  'Optional. What they hope to find. Never used for matching -- it is read by people, not by an algorithm.';
