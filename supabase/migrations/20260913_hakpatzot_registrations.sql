-- One-off Friday shuttle day ("הקפצות") ahead of the Misgav-Yaad enduro
-- weekend. Hard-capped at 15 riders (vehicles are booked, not elastic) —
-- CAPACITY in app/api/hakpatzot/route.ts is the single source of truth for
-- the number and must be kept in sync with any change here.
--
-- The public registration page never talks to Supabase directly, only
-- through app/api/hakpatzot/route.ts using the service-role key (same
-- pattern as trip_registrations / registrations), which bypasses RLS as
-- usual. The read/update policies below exist only for
-- app/admin/coordinator/hakpatzot — gated by is_coordinator() from the
-- start (the same function 20260910_tighten_authenticated_true_to_coordinator
-- retrofitted onto the older registration tables), not the wide-open
-- using(true) this repo has since moved away from.
create table if not exists hakpatzot_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  group_type text not null check (group_type in ('mini', 'full')),
  area text not null check (area in ('misgav', 'mata_asher', 'biriya')),
  consent boolean not null default false,
  -- Registering only holds a spot informally — the actual reservation is
  -- confirmed once payment goes through in Arbox, tracked here manually.
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled'))
);

alter table hakpatzot_registrations enable row level security;

create policy hakpatzot_registrations_select_coordinator
  on hakpatzot_registrations for select
  to authenticated
  using (is_coordinator());

create policy hakpatzot_registrations_update_coordinator
  on hakpatzot_registrations for update
  to authenticated
  using (is_coordinator())
  with check (is_coordinator());
