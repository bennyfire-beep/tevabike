-- Batch B: admin_roles read scope + riders write scope.
--
-- Neither of these can reuse is_coordinator()/is_salary_admin() as-is:
--   - admin_roles is legitimately read client-side by ALL THREE coordinators
--     on /admin/coordinator/staff (birth_date/id_number/certificate_url
--     included) — is_salary_admin() only covers two of them, so that would
--     break Tal's use of her own page. WRITE already correctly requires
--     is_salary_admin() (unchanged, not touched here).
--   - riders is written to directly from the INSTRUCTOR attendance screens
--     (app/admin/instructor/page.tsx, coordinator/attendance/page.tsx) to
--     toggle is_regular — is_coordinator() would lock instructors out of
--     their own daily workflow.
--
-- New function: is_staff() — true for anyone with an admin_roles row at
-- all (any role: admin/coordinator/instructor/accountant). Riders/parents
-- logged in via /student have no admin_roles row, so they never match.
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.admin_roles ar where ar.user_id = auth.uid()
  );
$$;

-- admin_roles: a coordinator still sees everyone (staff/page.tsx needs
-- this); anyone else only ever sees their own row (harmless — it's their
-- own data), never anyone else's ID number/birth date/certificate. A
-- rider/parent has no admin_roles row, so this matches nothing for them.
alter policy admin_roles_select on public.admin_roles
  using (is_coordinator() or auth.uid() = user_id);

-- riders: SELECT is deliberately left untouched here — the /student
-- portal's phone lookup (resolveRider) still depends on a broad read,
-- and redesigning that needs a dedicated pass with live OTP testing.
-- INSERT/UPDATE/DELETE tightened to any staff member (was: any
-- authenticated user at all, riders/parents included) — this is what let
-- a signed-in parent edit or delete ANY family's rider record, not just
-- their own.
drop policy if exists riders_auth_all on public.riders;

create policy riders_select on public.riders
  for select to authenticated using (true);

create policy riders_staff_write on public.riders
  for all to authenticated using (is_staff()) with check (is_staff());
