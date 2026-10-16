-- Activities in the rider app: one table for every camp / shuttle day / trip /
-- special event the coordinator publishes, instead of a new table + route +
-- hard-coded CAPACITY per activity (hanukkah_registrations, hakpatzot_…).
-- Managed at app/admin/coordinator/activities; riders browse and register
-- from /student through app/api/activities/route.ts.
--
-- Riders never touch these tables directly. The API uses the service-role key
-- (bypasses RLS, same pattern as every other registration route) and only
-- ever returns what a rider may see: counts, and the names of riders who
-- opted in to show_name. The policies below are for the coordinator screen.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'event'
    check (kind in ('camp', 'shuttle', 'trip', 'event', 'other')),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  location text,
  description text,
  image_url text,
  -- null = no limit
  capacity integer check (capacity is null or capacity > 0),
  price integer check (price is null or price >= 0),
  pay_url text,
  -- published: visible in the app at all. registration_open: can still sign up.
  published boolean not null default false,
  registration_open boolean not null default true,
  -- Whether the "who's going" list is shown for this activity at all. Even
  -- when on, only riders who chose show_name appear by name.
  show_attendees boolean not null default true
);

create index if not exists activities_start_idx on public.activities (start_date);

create table if not exists public.activity_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  -- Off by default: a rider's name is shown to other riders only by opt-in.
  show_name boolean not null default false,
  -- Parent approval, given in the registration form itself.
  parent_name text not null,
  parent_approved boolean not null default false check (parent_approved),
  parent_approved_at timestamptz not null default now(),
  -- The phone the form was submitted from, and whether it was the parent's.
  submitted_by_phone text,
  submitted_by_parent boolean not null default false,
  health_notes text,
  -- Registering holds a spot; payment is confirmed in Arbox and marked here.
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  cancelled_at timestamptz
);

-- One live registration per rider per activity; a cancelled one may be redone.
create unique index if not exists activity_registrations_one_live
  on public.activity_registrations (activity_id, rider_id)
  where status <> 'cancelled';

create index if not exists activity_registrations_activity_idx
  on public.activity_registrations (activity_id);

-- Atomic capacity check + insert. Locks the activity row so two riders
-- grabbing the last spot at the same moment can't both get it.
-- Returns the new registration id, or raises: 'not_found', 'closed', 'full',
-- 'already_registered'.
create or replace function public.register_for_activity(
  p_activity_id uuid,
  p_rider_id uuid,
  p_show_name boolean,
  p_parent_name text,
  p_submitted_by_phone text,
  p_submitted_by_parent boolean,
  p_health_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.activities%rowtype;
  v_taken integer;
  v_id uuid;
begin
  select * into v_activity from public.activities where id = p_activity_id for update;
  if not found or not v_activity.published then
    raise exception 'not_found';
  end if;
  if not v_activity.registration_open
     or coalesce(v_activity.end_date, v_activity.start_date) < current_date then
    raise exception 'closed';
  end if;

  if exists (
    select 1 from public.activity_registrations
    where activity_id = p_activity_id and rider_id = p_rider_id and status <> 'cancelled'
  ) then
    raise exception 'already_registered';
  end if;

  if v_activity.capacity is not null then
    select count(*) into v_taken from public.activity_registrations
    where activity_id = p_activity_id and status <> 'cancelled';
    if v_taken >= v_activity.capacity then
      raise exception 'full';
    end if;
  end if;

  insert into public.activity_registrations (
    activity_id, rider_id, show_name, parent_name, parent_approved,
    submitted_by_phone, submitted_by_parent, health_notes
  ) values (
    p_activity_id, p_rider_id, coalesce(p_show_name, false), p_parent_name, true,
    p_submitted_by_phone, coalesce(p_submitted_by_parent, false), p_health_notes
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Only the server (service role) may call it.
revoke all on function public.register_for_activity(uuid, uuid, boolean, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.register_for_activity(uuid, uuid, boolean, text, text, boolean, text) to service_role;

alter table public.activities enable row level security;
alter table public.activity_registrations enable row level security;

create policy activities_select_coordinator on public.activities
  for select to authenticated using (is_coordinator());
create policy activities_insert_coordinator on public.activities
  for insert to authenticated with check (is_coordinator());
create policy activities_update_coordinator on public.activities
  for update to authenticated using (is_coordinator()) with check (is_coordinator());
create policy activities_delete_coordinator on public.activities
  for delete to authenticated using (is_coordinator());

create policy activity_registrations_select_coordinator on public.activity_registrations
  for select to authenticated using (is_coordinator());
create policy activity_registrations_update_coordinator on public.activity_registrations
  for update to authenticated using (is_coordinator()) with check (is_coordinator());
create policy activity_registrations_delete_coordinator on public.activity_registrations
  for delete to authenticated using (is_coordinator());
