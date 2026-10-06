-- מחנה חנוכה בדרום, 16–19.12. Same shape as sukkot_registrations (the
-- Sukkot camp it's modelled on), plus riding_experience since this camp
-- requires at least a year of riding. CAPACITY / MIN_PARTICIPANTS live in
-- app/api/hanukkah-register/route.ts.
--
-- The public page only talks to Supabase through
-- app/api/hanukkah-register/route.ts with the service-role key, which
-- bypasses RLS. The policies below exist only for
-- app/admin/coordinator/camp-hanukkah and are gated by is_coordinator()
-- from the start.
create table if not exists public.hanukkah_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rider_first_name text not null,
  rider_last_name text not null,
  birth_date text,
  grade text,
  group_name text,
  riding_level text,
  riding_experience text,
  parent_name text not null,
  parent_phone text not null,
  second_parent_phone text,
  child_phone text,
  parent_email text not null,
  city text,
  health_notes text,
  food_notes text,
  total_amount integer not null,
  -- Registering only holds a spot informally — the reservation is confirmed
  -- once payment goes through in Arbox, tracked here manually.
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cancelled')),
  consent_parent_name text,
  consent_approved boolean not null default false,
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

alter table public.hanukkah_registrations enable row level security;

create policy hanukkah_reg_read
  on public.hanukkah_registrations for select
  to authenticated
  using (is_coordinator());

create policy hanukkah_reg_update
  on public.hanukkah_registrations for update
  to authenticated
  using (is_coordinator())
  with check (is_coordinator());
