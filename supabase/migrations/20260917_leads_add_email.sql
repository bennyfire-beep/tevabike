-- Add an optional email column to the shared leads table.
--
-- The instructors-course landing page (app/api/course-instructors-register)
-- needs to keep an email address per lead so it can send a confirmation with
-- the college registration link. No existing lead source collects it, so it's
-- nullable and backward compatible.

alter table public.leads add column if not exists email text;
