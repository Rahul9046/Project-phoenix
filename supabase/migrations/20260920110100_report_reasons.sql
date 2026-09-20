-- Report reasons a member would actually recognise.
--
-- `report_reason` has existed since 20260830160300 and was drawn up before
-- anybody had used the report button. It is missing the three things a dating
-- product is reported for most often -- unwanted promotion, a threat, and
-- somebody who is not eighteen -- and it carries one category
-- (`incorrect_relationship_status`) that nobody reporting a stranger has ever
-- reached for, because it describes a disagreement rather than harm.
--
-- So: three values added, none removed.
--
-- Nothing is removed because removing an enum value is not a thing Postgres
-- offers, and more to the point because reports already filed with it are
-- evidence. `incorrect_relationship_status` simply stops being offered by the
-- two clients; the admin queue still knows how to label it, and the rows that
-- carry it keep reading correctly forever.
--
-- Added rather than replaced with a lookup table, deliberately. The enum is
-- what makes an invalid identifier a 400 from PostgREST rather than a row in
-- the table nobody notices -- the database refuses "not_a_reason" before any
-- application code has an opinion, on both clients at once, and on any client
-- written later.

alter type public.report_reason add value if not exists 'spam';
alter type public.report_reason add value if not exists 'safety_threat';
alter type public.report_reason add value if not exists 'underage';

comment on type public.report_reason is
  'The fixed list of report categories. Values are never removed: a category that stops being offered still has to read correctly on the reports already filed under it.';

-- ---------------------------------------------------------------------------
-- "Something else" has to say something
-- ---------------------------------------------------------------------------
--
-- Every other category carries its own meaning, so the written details beside
-- it are genuinely optional -- "Harassment or abusive behaviour" with nothing
-- further is still a report a human can act on. "Other" carries none, and a
-- report that says only `other` is a row that cost somebody the courage to
-- file and tells a moderator nothing at all.
--
-- NOT VALID on purpose. Reports filed before this migration were allowed to be
-- `other` with an empty description -- the app's own picker permitted it -- and
-- validating against them would either fail the migration or force us to edit
-- other people's words to make our constraint true. Existing rows are left
-- exactly as they were filed; everything written from here is checked.

alter table public.member_reports
  add constraint member_reports_other_needs_description
    check (
      reason_code <> 'other'
      or (description is not null and length(btrim(description)) > 0)
    )
    not valid;

comment on constraint member_reports_other_needs_description on public.member_reports is
  'A report of "other" must say what happened. NOT VALID: reports filed before the rule existed are left as they were.';
