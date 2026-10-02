-- Guided riding trips around Israel ("טיולי רכיבה") — two a month, joined
-- with a monthly subscription (₪200, both trips, open to everyone) or, for
-- Teva Bike riders, as a single trip (₪90). The trips are configured in
-- lib/ride-sessions.ts; registrations are tagged with the ride's slug and the
-- per-ride cap is counted there.
--
-- rider_type / price_ils are decided server-side in app/api/rides/route.ts:
-- 'member' only when the phone matches riders.phone or riders.parent_phone,
-- so the member price can't be claimed just by ticking the box; a
-- subscriber's second trip of the month (same phone, same
-- subscription_month) is stored at price_ils 0. price_ils is
-- stored on the row so a later price change never rewrites what someone was
-- quoted.
--
-- Same convention as hakpatzot_registrations: the public form only talks to
-- Supabase through the API route (service role, bypasses RLS); the policies
-- below exist only for app/admin/coordinator/rides.
create table if not exists ride_session_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_slug text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  -- 'subscriber' = monthly subscription (both of the month's trips),
  -- 'member' = a single trip for a Teva Bike rider. A subscriber's later
  -- trips in the same month are stored with price_ils 0 (included).
  rider_type text not null check (rider_type in ('subscriber', 'member')),
  price_ils numeric not null,
  subscription_month text,
  notes text,
  -- Electric-bike rental request. rental_height_cm is for picking a frame
  -- size; rental_price_ils is the rental price at registration time.
  wants_rental boolean not null default false,
  rental_height_cm int,
  rental_price_ils numeric,
  consent boolean not null default false,
  -- Registering only holds a spot informally — the reservation is confirmed
  -- once payment goes through in Arbox, tracked here manually.
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text,
  -- Set by app/api/cron/ride-reminders once the 2-days-before reminder email
  -- went out, so a rerun of the cron never sends it twice.
  reminder_sent_at timestamptz
);

create index if not exists ride_session_registrations_slug_idx
  on ride_session_registrations (session_slug, created_at);

alter table ride_session_registrations enable row level security;

create policy ride_session_registrations_select_coordinator
  on ride_session_registrations for select
  to authenticated
  using (is_coordinator());

create policy ride_session_registrations_update_coordinator
  on ride_session_registrations for update
  to authenticated
  using (is_coordinator())
  with check (is_coordinator());
