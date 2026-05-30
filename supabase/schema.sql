-- Tevbike Admin Dashboard — Database Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- ─── Admin roles ───────────────────────────────────────────────────────────
create table if not exists admin_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade unique,
  role       text not null check (role in ('instructor', 'coordinator', 'accountant')),
  name       text not null,
  branch     text,                        -- relevant for instructors
  hourly_rate numeric(8,2) default 60,   -- for accountant view
  created_at timestamptz default now()
);

-- ─── Class sessions (each training session) ────────────────────────────────
create table if not exists class_sessions (
  id              uuid primary key default gen_random_uuid(),
  class_name      text not null,
  branch          text not null,
  session_date    date not null default current_date,
  instructor_id   uuid references admin_roles(id),
  instructor_name text,
  duration_hours  numeric(4,2) not null default 1.5,
  notes           text,
  created_at      timestamptz default now()
);

-- ─── Attendance records ─────────────────────────────────────────────────────
create table if not exists attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references class_sessions(id) on delete cascade,
  rider_id    uuid references riders(id) on delete cascade,
  rider_name  text,
  present     boolean not null default true,
  created_at  timestamptz default now(),
  unique(session_id, rider_id)
);

-- ─── Payment records ────────────────────────────────────────────────────────
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid references riders(id) on delete cascade,
  rider_name  text not null,
  month       text not null,  -- YYYY-MM format, e.g. '2026-05'
  amount      numeric(10,2) not null default 350,
  status      text not null check (status in ('paid', 'pending', 'overdue')) default 'pending',
  notes       text,
  created_at  timestamptz default now(),
  unique(rider_id, month)
);

-- ─── Row-Level Security ─────────────────────────────────────────────────────
alter table admin_roles    enable row level security;
alter table class_sessions enable row level security;
alter table attendance     enable row level security;
alter table payments       enable row level security;

-- Allow authenticated users full access (tighten per-role in production)
create policy "auth_admin_roles"    on admin_roles    for all to authenticated using (true) with check (true);
create policy "auth_class_sessions" on class_sessions for all to authenticated using (true) with check (true);
create policy "auth_attendance"     on attendance     for all to authenticated using (true) with check (true);
create policy "auth_payments"       on payments       for all to authenticated using (true) with check (true);

-- ─── Rate limiting ─────────────────────────────────────────────────────────
-- Managed server-side via SUPABASE_SERVICE_ROLE_KEY — clients never touch this table.
create table if not exists rate_limits (
  id           uuid primary key default gen_random_uuid(),
  identifier   text not null,                      -- phone or email
  action       text not null check (action in ('otp', 'login')),
  attempts     int  not null default 1,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  unique(identifier, action)
);

-- Only service_role can access rate_limits (RLS enabled, no public policies)
alter table rate_limits enable row level security;

-- ─── Helper functions for RLS policies ──────────────────────────────────────
-- Returns the admin role for the current auth user (null if not an admin)
create or replace function get_admin_role()
returns text language sql security definer stable as $$
  select role from admin_roles where user_id = auth.uid() limit 1
$$;

-- Returns the rider_id linked to the current auth user (null if not a student)
create or replace function get_rider_id()
returns uuid language sql security definer stable as $$
  select rider_id from rider_settings where user_id = auth.uid() limit 1
$$;

-- ─── Tighten existing RLS policies ──────────────────────────────────────────
-- Drop the overly-permissive blanket policies and replace with role-aware ones.

drop policy if exists "auth_admin_roles"    on admin_roles;
drop policy if exists "auth_class_sessions" on class_sessions;
drop policy if exists "auth_attendance"     on attendance;
drop policy if exists "auth_payments"       on payments;

-- admin_roles: only admins can read their own row; coordinator reads all
create policy "admin_roles_select" on admin_roles
  for select to authenticated
  using (
    user_id = auth.uid()                         -- own row always visible
    or get_admin_role() = 'coordinator'           -- coordinator sees all
    or get_admin_role() = 'accountant'            -- accountant sees all (for hours)
  );

-- Only service_role (server code) may insert/update admin_roles
create policy "admin_roles_service_write" on admin_roles
  for all to service_role using (true) with check (true);

-- class_sessions: admins can see all; students see only their class
create policy "class_sessions_read" on class_sessions
  for select to authenticated
  using (
    get_admin_role() is not null               -- any admin
    or (                                        -- student: only their class
      class_name = (select group_name from riders where id = get_rider_id() limit 1)
      and branch  = (select branch      from riders where id = get_rider_id() limit 1)
    )
  );

create policy "class_sessions_write" on class_sessions
  for all to authenticated
  using  (get_admin_role() in ('instructor', 'coordinator'))
  with check (get_admin_role() in ('instructor', 'coordinator'));

-- attendance: instructors write; coordinators & students read own rows
create policy "attendance_read" on attendance
  for select to authenticated
  using (
    get_admin_role() in ('instructor', 'coordinator', 'accountant')   -- any admin
    or rider_id = get_rider_id()                                        -- own row (student)
  );

create policy "attendance_write" on attendance
  for all to authenticated
  using  (get_admin_role() in ('instructor', 'coordinator'))
  with check (get_admin_role() in ('instructor', 'coordinator'));

-- payments: accountant full access; students read own rows
create policy "payments_read" on payments
  for select to authenticated
  using (
    get_admin_role() in ('accountant', 'coordinator')
    or rider_id = get_rider_id()
  );

create policy "payments_write" on payments
  for all to authenticated
  using  (get_admin_role() = 'accountant')
  with check (get_admin_role() = 'accountant');

-- riders: admins read all; students read only their own record
alter table if exists riders enable row level security;

drop policy if exists "auth_read_riders" on riders;

create policy "riders_admin_read" on riders
  for select to authenticated
  using (get_admin_role() is not null);

create policy "riders_self_read" on riders
  for select to authenticated
  using (id = get_rider_id());

create policy "riders_admin_write" on riders
  for all to authenticated
  using  (get_admin_role() in ('instructor', 'coordinator'))
  with check (get_admin_role() in ('instructor', 'coordinator'));

-- ─── Student portal — rider settings ──────────────────────────────────────
-- Maps a Supabase Auth phone-user to a rider record + privacy preference.
create table if not exists rider_settings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade unique,
  rider_id       uuid references riders(id) on delete cascade,
  privacy_hidden boolean not null default false,   -- true → instructor sees anonymous
  created_at     timestamptz default now()
);

alter table rider_settings enable row level security;
-- Students can only read/write their own row
create policy "rider_own_settings" on rider_settings
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Instructors/coordinators need to read privacy flags (service-role or relaxed policy):
create policy "admin_read_rider_settings" on rider_settings
  for select to authenticated using (true);

-- Allow authenticated users to read the riders table (for student portal phone matching)
-- Run only if RLS is not yet enabled on riders:
-- alter table riders enable row level security;
-- create policy "auth_read_riders" on riders for select to authenticated using (true);

-- ─── Instructor hours log ───────────────────────────────────────────────────
-- Auto-populated when instructor saves attendance; one row per session per instructor.
create table if not exists instructor_hours (
  id            uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references admin_roles(id) on delete cascade,
  session_id    uuid not null references class_sessions(id) on delete cascade,
  date          date not null,
  class_name    text not null,
  branch        text not null,
  hours         numeric(4,2) not null default 1.5,
  created_at    timestamptz default now(),
  unique(session_id, instructor_id)   -- one log entry per session per instructor
);

alter table instructor_hours enable row level security;

-- Instructors: read/write only their own rows
create policy "hours_instructor_rw" on instructor_hours
  for all to authenticated
  using  (instructor_id = (select id from admin_roles where user_id = auth.uid()))
  with check (instructor_id = (select id from admin_roles where user_id = auth.uid()));

-- Coordinators and accountants: read all
create policy "hours_admin_read" on instructor_hours
  for select to authenticated
  using (get_admin_role() in ('coordinator', 'accountant'));

-- ─── Sample data — create users in Auth first, then run this ───────────────
-- INSERT INTO admin_roles (user_id, role, name, branch) VALUES
--   ('<instructor-uid>',  'instructor',  'דני לוי',      'משגב'),
--   ('<coordinator-uid>', 'coordinator', 'מיכל כהן',     null),
--   ('<accountant-uid>',  'accountant',  'רונן אברהם',   null);
