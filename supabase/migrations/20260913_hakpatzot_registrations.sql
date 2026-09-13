-- One-off Friday shuttle day ("הקפצות") ahead of the Misgav-Yaad enduro
-- weekend. Hard-capped at 15 riders (vehicles are booked, not elastic) —
-- HAKPATZOT_CAPACITY in app/api/hakpatzot/route.ts is the single source of
-- truth for the number and must be kept in sync with any change here.
--
-- No public RLS policies: the page never talks to Supabase directly, only
-- through app/api/hakpatzot/route.ts using the service-role key (same
-- pattern as trip_registrations / registrations), so RLS stays closed and
-- the service role bypasses it as usual.
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
