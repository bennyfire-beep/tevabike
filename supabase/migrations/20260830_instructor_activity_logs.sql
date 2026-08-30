-- "פעילות אחרת" — an instructor reporting hours on something that isn't a
-- lesson (צילום, תיקון אופניים, ...), for pay once a salary admin approves it
-- and sets the rate.
--
-- Rate is deliberately NOT on the instructor: each report is priced on its
-- own by a salary admin at approval time (hourly_rate stays null until then),
-- because "what this particular activity is worth" is a per-report judgement,
-- not a standing wage. Nothing here counts toward pay until status='approved'
-- — see the "פעילויות נוספות" section added to the salary reports, which all
-- filter on that.
--
-- Locked down the same way staff_pay / instructor_travel already are (see
-- 20260820_lock_down_salary_data.sql): RLS admits only is_salary_admin() —
-- Benny and Shir. An instructor's own reads/writes do NOT go through RLS —
-- they go through service-role API routes that resolve the caller from their
-- access token via lib/instructor-identity.ts, exactly like
-- /api/instructor/travel-save and /api/instructor/my-salary already do for
-- the tables that sit next to this one. That is a deliberate choice, not an
-- oversight: it keeps one instructor from ever being able to read another's
-- reports via a direct REST call, the same guarantee staff_pay has.

create table if not exists public.instructor_activity_logs (
  id                    uuid primary key default gen_random_uuid(),
  instructor_id         uuid not null references public.admin_roles(id),
  activity_date         date not null,
  activity_type         text not null,        -- 'צילום' | 'תיקון אופניים' | 'אחר' | ...
  activity_type_other   text,                  -- free text when activity_type = 'אחר'
  description           text,                  -- free text, always available
  hours                 numeric not null check (hours > 0),
  hourly_rate           numeric,               -- set only on approval; null until then
  status                text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by           uuid references public.admin_roles(id),
  approved_at           timestamptz,
  created_at            timestamptz not null default now()
);

-- total_amount (hours * hourly_rate) is computed where it's needed, not
-- stored — so a rate correction before approval can never leave a stale
-- amount lying around.

create index if not exists instructor_activity_logs_instructor_idx
  on public.instructor_activity_logs (instructor_id, activity_date);
create index if not exists instructor_activity_logs_status_idx
  on public.instructor_activity_logs (status);

alter table public.instructor_activity_logs enable row level security;

drop policy if exists instructor_activity_logs_salary_admin on public.instructor_activity_logs;
create policy instructor_activity_logs_salary_admin on public.instructor_activity_logs
  for all to authenticated
  using (public.is_salary_admin()) with check (public.is_salary_admin());
