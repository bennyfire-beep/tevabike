-- One-day ride "סובב מצפה רמון" on election day, 27.10.2026 (/sovev-ramon).
-- Riders pick how they get there: in Benny's car ('ride') or on their own
-- ('self'). The car is hard-capped at RIDE_SEATS (lib/sovev-ramon.ts, 8 riders
-- + Benny); arriving independently is not capped. The cap is enforced in
-- app/api/sovev-ramon/route.ts by insertion rank, same as hakpatzot.
--
-- Same access model as hakpatzot_registrations: the public page only goes
-- through the API with the service-role key; the policies below are for the
-- coordinator only.
create table if not exists sovev_ramon_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  transport text not null check (transport in ('ride', 'self')),
  consent boolean not null default false,
  -- Registering holds the spot; payment is confirmed in Arbox and marked here by hand.
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

alter table sovev_ramon_registrations enable row level security;

create policy sovev_ramon_registrations_select_coordinator
  on sovev_ramon_registrations for select
  to authenticated
  using (is_coordinator());

create policy sovev_ramon_registrations_update_coordinator
  on sovev_ramon_registrations for update
  to authenticated
  using (is_coordinator())
  with check (is_coordinator());
