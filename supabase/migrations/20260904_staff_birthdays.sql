-- Staff birthday reminders — feeds /api/cron/staff-birthdays, which emails
-- Benny/Tal/Shir (and optionally WhatsApps Benny) 7 days before a staff
-- member's birthday.
--
-- Deliberately a standalone table, not a birth_date column on admin_roles:
-- a few people there have two admin_roles rows for two hats (e.g. טל ברקן is
-- both instructor and coordinator), which would make "whose birthday is this
-- row for" ambiguous if FK'd to admin_roles.id. Stored as plain day/month
-- (+ optional year, since not everyone's is on file) rather than a single
-- `date` so a missing birth year never blocks the day+month the reminder
-- actually runs on.

create table if not exists public.staff_birthdays (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  birth_day   smallint not null check (birth_day between 1 and 31),
  birth_month smallint not null check (birth_month between 1 and 12),
  birth_year  smallint,                       -- nullable: not everyone's is on file yet
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (full_name)
);

-- One row per (person, day the reminder fired) — stops the daily cron from
-- re-sending the same "in 7 days" alert if it happens to run more than once
-- on the day it matches. Same dedupe shape as public.absence_alerts.
create table if not exists public.staff_birthday_alerts (
  id                 uuid primary key default gen_random_uuid(),
  staff_birthday_id  uuid not null references public.staff_birthdays(id) on delete cascade,
  notify_date        date not null,
  created_at         timestamptz not null default now(),
  unique (staff_birthday_id, notify_date)
);

alter table public.staff_birthdays       enable row level security;
alter table public.staff_birthday_alerts enable row level security;

-- Same shape as the WhatsApp CRM tables (see 20260827_whatsapp_conversations.sql):
-- the cron route runs with the service role and is the real gate; this is a
-- defence-in-depth backstop for direct client reads, not the enforcement.
drop policy if exists "staff_birthdays_select" on public.staff_birthdays;
create policy "staff_birthdays_select" on public.staff_birthdays
  for select to authenticated using (true);

drop policy if exists "staff_birthdays_service_write" on public.staff_birthdays;
create policy "staff_birthdays_service_write" on public.staff_birthdays
  for all to service_role using (true) with check (true);

drop policy if exists "staff_birthday_alerts_select" on public.staff_birthday_alerts;
create policy "staff_birthday_alerts_select" on public.staff_birthday_alerts
  for select to authenticated using (true);

drop policy if exists "staff_birthday_alerts_service_write" on public.staff_birthday_alerts;
create policy "staff_birthday_alerts_service_write" on public.staff_birthday_alerts
  for all to service_role using (true) with check (true);

-- Seed data from "צוות 2026 טבע בייק" (loaded 2026-09-04).
insert into public.staff_birthdays (full_name, birth_day, birth_month, birth_year) values
  ('ארז דגן',        16, 2, 2008),
  ('אלון תירוש',     7,  1, 2009),
  ('תומס סלימן',     3,  9, 2003),
  ('אליאב כהן',      19, 5, 2009),
  ('טל ברקן',        12, 6, 1976),
  ('שיר קובי',       2,  7, 2001),
  ('הילל זלנקובסקי', 13, 2, 2009)
on conflict (full_name) do update set
  birth_day   = excluded.birth_day,
  birth_month = excluded.birth_month,
  birth_year  = excluded.birth_year;
