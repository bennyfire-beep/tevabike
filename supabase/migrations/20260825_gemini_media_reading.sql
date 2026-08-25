-- Every document/image/video the app receives now gets read through the Gemini
-- API (see lib/gemini.ts), not just the manual /admin/coordinator/gemini tool.
-- These columns store what Gemini extracted, next to the file itself.

-- Passport photo uploaded on the public trip registration form.
alter table public.trip_registrations
  add column if not exists passport_gemini_text text;

-- Instructor certificate uploaded on /admin/coordinator/staff.
-- birth_date / id_number / certificate_url already exist in production (added
-- via the dashboard, not tracked here) — declared "if not exists" so this
-- migration is safe to run either way.
alter table public.admin_roles
  add column if not exists birth_date date;
alter table public.admin_roles
  add column if not exists id_number text;
alter table public.admin_roles
  add column if not exists certificate_url text;
alter table public.admin_roles
  add column if not exists certificate_gemini_text text;
