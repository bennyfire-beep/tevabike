-- Manual per-session pay-band override for the coordinator payroll report.
--
-- Regular lessons on the by_attendance model price themselves from
-- class_sessions.present_count (see lib/lesson-pay.ts), but present_count
-- can be wrong — e.g. a session opened twice for the same real class (as
-- happened for מיני גרביטי/משגב on 2026-09-17, fixed by hand this session)
-- inflates it. Rather than hand-editing attendance data (which risks
-- falsely marking a specific rider absent/present, and gets silently
-- overwritten the next time the session's register is resaved), Benny can
-- pin a session's band directly: low/mid/high, same three tiers as
-- staff_pay's own attendance_rate_low/mid/high, applied via
-- lib/lesson-pay.ts:rateForBand for each credited instructor's own
-- configured rate — never a hardcoded number.
--
-- Applied directly to the live database; tracked here for the record.

create table public.session_pay_overrides (
  session_id uuid primary key references public.class_sessions(id) on delete cascade,
  band       text not null check (band in ('low', 'mid', 'high')),
  set_by     uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.session_pay_overrides enable row level security;

-- Only Benny may set/change/clear an override — this is the real
-- enforcement; the UI in app/admin/coordinator/payroll/page.tsx only ever
-- shows the control to him (isBenny()), matching how session deletion on
-- the same screen is already gated (class_sessions coordinator_delete_sessions
-- policy, is_benny()).
create policy session_pay_overrides_benny_write on public.session_pay_overrides
  for all to authenticated
  using (is_benny())
  with check (is_benny());

-- Both salary admins (Benny + Shir) view the payroll report and must see
-- the same numbers — matches instructor_travel's read scope.
create policy session_pay_overrides_salary_admin_read on public.session_pay_overrides
  for select to authenticated
  using (is_salary_admin());
