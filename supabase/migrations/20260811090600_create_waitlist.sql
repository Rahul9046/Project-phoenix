-- Landing page waitlist.
--
-- Replaces the JSONL file the server action used to append to, which was never
-- durable on serverless or multi-instance hosting.
--
-- Deliberately unrelated to `profiles`: someone joining the waitlist has no
-- account, and may never create one.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  -- Whichever city they named, listed or not. Free text, because this form
  -- accepts anyone anywhere.
  city text not null,
  -- 'early_access' when they named a launch city, 'waitlist' otherwise.
  list text not null default 'waitlist',
  created_at timestamptz not null default now(),

  constraint waitlist_list_known check (list in ('early_access', 'waitlist')),
  constraint waitlist_email_shape check (position('@' in email) > 1)
);

comment on table public.waitlist is
  'Landing page signups. Insert-only from the browser; reading requires the service role.';

-- One entry per address.
--
-- Insert-only by design (see the RLS migration): a second submission raises a
-- unique violation, which the server action treats as "already on the list".
-- Allowing an update instead would let anyone overwrite a stranger's entry by
-- guessing their email.
create unique index waitlist_email_key on public.waitlist (lower(email));
