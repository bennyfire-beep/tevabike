-- Club inauguration ("חנוכת מועדון") — Friday 4.12.2026. 08:00 gathering at
-- אתגר, 08:30–10:30 a fun competition on 20" bikes, then everyone climbs up
-- to the new club building for refreshments and the inauguration at 10:30.
-- Open to every Teva Bike group, kids and adults. No cap, no payment —
-- registration is required so the team can plan bikes, food and space.
-- Config (date, groups, food options) lives in lib/club-opening.ts.
--
-- Same convention as parent_meeting_registrations: the public form only talks
-- to Supabase through app/api/club-opening (service role, bypasses RLS);
-- these policies exist only for app/admin/coordinator/club-opening.
create table if not exists club_opening_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_date date not null,
  participation text not null check (participation in ('activity', 'party_only')),
  group_name text not null,
  contact_name text not null,
  phone text not null,
  -- Names of the riders joining the competition (empty for party_only).
  rider_names text,
  riders_count smallint not null default 0 check (riders_count between 0 and 6),
  -- Everyone coming, riders included.
  attendees smallint not null default 1 check (attendees between 1 and 10),
  -- What the family brings: pastries / vegetables / pita_labane / hummus /
  -- drinks / other (lib/club-opening.ts FOOD).
  bringing text[] not null default '{}',
  bringing_other text,
  notes text,
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

create index if not exists club_opening_registrations_date_idx
  on club_opening_registrations (event_date, created_at);

alter table club_opening_registrations enable row level security;

create policy club_opening_registrations_select_coordinator
  on club_opening_registrations for select
  to authenticated
  using (is_coordinator());

create policy club_opening_registrations_delete_coordinator
  on club_opening_registrations for delete
  to authenticated
  using (is_coordinator());
