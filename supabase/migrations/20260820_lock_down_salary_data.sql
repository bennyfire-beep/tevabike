-- Salary, rates and travel are readable and writable only by Benny and Shir.
-- Enforced in the database, so a direct REST call with any other valid token
-- returns nothing — the UI is no longer the only line of defence.
-- (Applied to production 2026-08-20.)

create or replace function public.is_salary_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select auth.uid() in (
           'b0bd8d88-c8f0-4e7a-91e0-362e0247385f'::uuid,  -- בני להט
           '9abf2e1a-c6c4-4e1d-868d-901cfd602f4f'::uuid   -- שיר קובי
         )
      or lower(coalesce(auth.jwt() ->> 'email', '')) in (
           'bennyfire@gmail.com', 'shirkobi8@gmail.com'
         );
$function$;

drop policy if exists staff_pay_read   on public.staff_pay;
drop policy if exists staff_pay_insert on public.staff_pay;
drop policy if exists staff_pay_update on public.staff_pay;
drop policy if exists staff_pay_delete on public.staff_pay;
drop policy if exists staff_pay_salary_admin on public.staff_pay;
create policy staff_pay_salary_admin on public.staff_pay
  for all to authenticated
  using (public.is_salary_admin()) with check (public.is_salary_admin());

drop policy if exists instructor_travel_all on public.instructor_travel;
drop policy if exists instructor_travel_salary_admin on public.instructor_travel;
create policy instructor_travel_salary_admin on public.instructor_travel
  for all to authenticated
  using (public.is_salary_admin()) with check (public.is_salary_admin());

-- admin_roles SELECT stays open to authenticated: every login reads its own row
-- to resolve the role, and the attendance and groups screens list instructors by
-- name. No pay lives on this table (hourly_rate was dropped), so reading it
-- discloses no salary. Writes are salary-admin only.
drop policy if exists admin_roles_select on public.admin_roles;
drop policy if exists admin_roles_write  on public.admin_roles;
create policy admin_roles_select on public.admin_roles
  for select to authenticated using (true);
create policy admin_roles_write on public.admin_roles
  for all to authenticated
  using (public.is_salary_admin()) with check (public.is_salary_admin());

-- A column-level REVOKE is a no-op while a table-wide grant exists, so the
-- table-wide SELECT/UPDATE goes first and is re-granted column by column with
-- instructor_pay left out.
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema='public' and table_name='class_sessions'
    and column_name <> 'instructor_pay';
  revoke select, update on public.class_sessions from authenticated, anon;
  execute format('grant select (%s) on public.class_sessions to authenticated, anon', cols);
  execute format('grant update (%s) on public.class_sessions to authenticated, anon', cols);
end $$;

-- SECURITY DEFINER with no authorisation check: any signed-in user could call
-- it and get the salary table back.
drop function if exists public.monthly_salary_report(text);

-- Disable the unused admin@tevbike.com login. Not deleted.
update auth.users set banned_until = 'infinity'::timestamptz
where email = 'admin@tevbike.com';
