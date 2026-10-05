-- Parents' meeting ("אסיפת הורים") — Wednesday 21.10, the new club building
-- in Rakefet, in two sessions: gravity beginners + mini (19:15–20:15) and
-- gravity pro/competitive (20:30–21:30). No cap, no payment — registration
-- exists so the club can prepare the room and know who is coming to which
-- session. Dates and sessions live in lib/parent-meeting.ts.
--
-- Same convention as hakpatzot_registrations / hashlama_registrations: the
-- public form only ever talks to Supabase through app/api/parent-meeting
-- (service role, bypasses RLS); these policies exist only for
-- app/admin/coordinator/parent-meeting.
create table if not exists parent_meeting_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Tagged with the meeting date so a future meeting starts from zero while
  -- this one stays in the table as history (same idea as
  -- hakpatzot_registrations.event_date).
  meeting_date date not null,
  session text not null check (session in ('beginners_mini', 'pro')),
  parent_name text not null,
  phone text not null,
  rider_name text not null,
  attendees smallint not null default 1 check (attendees between 1 and 4),
  notes text,
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

create index if not exists parent_meeting_registrations_date_idx
  on parent_meeting_registrations (meeting_date, session, created_at);

alter table parent_meeting_registrations enable row level security;

create policy parent_meeting_registrations_select_coordinator
  on parent_meeting_registrations for select
  to authenticated
  using (is_coordinator());

create policy parent_meeting_registrations_delete_coordinator
  on parent_meeting_registrations for delete
  to authenticated
  using (is_coordinator());
