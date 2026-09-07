-- "גפן" special activity: Benny and Tal log hours per school, paid at a fixed
-- ₪90/hour regardless of the instructor's own staff_pay.hourly_rate (which
-- prices every other special activity, e.g. camps). Reuses the existing
-- special-activity session (class_sessions.type='special'): the school name
-- goes in `branch` (already free-text for regular sessions), the hours in
-- `duration`, exactly like any other special activity — this flag is the only
-- new thing, so the payroll code can tell "גפן" apart from everything else
-- priced at the instructor's own rate.
alter table public.class_sessions
  add column if not exists is_gefen boolean not null default false;

-- 20260820_lock_down_salary_data.sql revoked the table-wide SELECT/UPDATE
-- grant on class_sessions and re-granted it column by column (everything
-- except instructor_pay). A column added afterwards is not covered by that
-- grant automatically — without this, `authenticated`/`anon` could insert
-- is_gefen (INSERT was never column-restricted) but never read it back.
grant select (is_gefen), update (is_gefen) on public.class_sessions to authenticated, anon;
