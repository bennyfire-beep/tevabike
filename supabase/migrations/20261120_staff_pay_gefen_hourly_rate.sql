-- Per-instructor "גפן" rate. Until now every Gefen hour was priced at the
-- global GEFEN_HOURLY_RATE (₪90, lib/attendance.ts). Ofir Cohen joins at ₪90
-- per 45 minutes, i.e. ₪120/hour — temporary, for his first month, so it is a
-- value in the DB that can be changed without a deploy, not a constant.
--
--   null  → the global default (GEFEN_HOURLY_RATE, ₪90/hour)
--   value → this instructor's own Gefen rate per hour
--
-- Deliberately separate from hourly_rate, which prices every OTHER special
-- activity (camps, ימי שיא) — the two must never be mixed.
--
-- staff_pay stays locked to salary admins (staff_pay_salary_admin policy,
-- 20260820_lock_down_salary_data.sql); its grants are table-wide, so the new
-- column needs no grant of its own.
alter table public.staff_pay
  add column if not exists gefen_hourly_rate numeric;

-- Ofir Cohen (admin_roles 5af24d21-…, instructor, משגב): ₪120/hour.
update public.staff_pay
  set gefen_hourly_rate = 120
  where admin_role_id = '5af24d21-8305-4d8b-ae5b-66a14d364300';
