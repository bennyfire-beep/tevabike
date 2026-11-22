-- מחנה חנוכה במשגב — 6–7.12.2026, 08:30–13:00 at the Teva Bike club.
-- Day camp for the mini gravity / beginners groups (Misgav, Biriya, Mateh
-- Asher), ages 10–13. Registration is per day, 200 ₪ each; `days` holds the
-- chosen dates. Each day opens only with at least 8 riders. Config lives in
-- lib/camp-misgav.ts.
--
-- Same convention as hanukkah_registrations: the public form only talks to
-- Supabase through app/api/hanukkah-misgav-register (service role, bypasses
-- RLS); these policies exist only for app/admin/coordinator/camp-hanukkah-misgav.
create table if not exists public.hanukkah_misgav_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rider_first_name text not null,
  rider_last_name text not null,
  age text,
  group_name text,
  days text[] not null,
  parent_name text not null,
  parent_phone text not null,
  parent_email text,
  city text not null,
  health_notes text,
  total_amount integer not null,
  -- The spot is confirmed only after payment in Arbox, tracked here manually.
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cancelled')),
  consent_parent_name text,
  consent_approved boolean not null default false,
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

alter table public.hanukkah_misgav_registrations enable row level security;

create policy hanukkah_misgav_reg_read
  on public.hanukkah_misgav_registrations for select
  to authenticated
  using (is_coordinator());

create policy hanukkah_misgav_reg_update
  on public.hanukkah_misgav_registrations for update
  to authenticated
  using (is_coordinator())
  with check (is_coordinator());
