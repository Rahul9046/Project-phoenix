-- Make a local Supabase stack grant what a hosted one grants.
--
-- LOCAL ENVIRONMENT SETUP. Not a migration, and it must never become one: on a
-- hosted project every statement here is already true before the first
-- migration runs.
--
-- `supabase migration up` applies migrations as `postgres`, and in this image
-- the default ACL for objects `postgres` creates in schema `public` is far
-- narrower than the one `supabase_admin` carries:
--
--   supabase_admin  tables arwdDxtm  sequences rwU  functions X   to anon, authenticated, service_role
--   postgres        tables Dxtm      sequences w    functions -   to anon, authenticated, service_role
--
-- So a database built by `migration up` hands `authenticated` no SELECT on any
-- table and hands `service_role` no EXECUTE on any function. None of the 69
-- migrations compensates, because on a hosted project none of them has to:
-- they revoke from `public` and `anon` and grant to `authenticated` on top of a
-- default that already exists.
--
-- Two things follow, and both are worse than a broken environment.
--
--   * Every member request answers 42501 "permission denied". An
--     access-control probe whose every attempt is refused by a missing GRANT
--     passes completely while testing nothing at all.
--   * Every service-role call answers 42501 too, so the payment probe cannot
--     settle or revoke anything and reports failures that do not exist in
--     production.
--
-- Run this against an EMPTY local database, BEFORE `supabase migration up`.
-- Order matters: a default ACL applies to objects created after it is set, so
-- running this afterwards fixes nothing, and a blanket GRANT afterwards is not
-- equivalent -- it would hand `anon` the EXECUTE that twenty migrations
-- deliberately revoke, and quietly undo the controls under test.
--
-- See docs/18-local-validation.md.

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
