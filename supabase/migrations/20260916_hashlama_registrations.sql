-- Makeup training day ("אימון השלמה") — Tuesday 22.9, Rakefet, free, open to
-- riders from all three branches. No cap, no payment — registration exists
-- purely so the coordinator can plan the right number of instructors per
-- branch/group ahead of time (see app/api/hashlama/route.ts and
-- app/admin/coordinator/hashlama).
create table if not exists hashlama_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  branch text not null check (branch in ('misgav', 'matzuva', 'biriya')),
  group_type text not null check (group_type in ('beginners', 'mini', 'pro'))
);

alter table hashlama_registrations enable row level security;

-- Same convention as hakpatzot_registrations: the public form only ever
-- talks to Supabase through the API route (service role, bypasses RLS);
-- these policies exist only for app/admin/coordinator/hashlama.
create policy hashlama_registrations_select_coordinator
  on hashlama_registrations for select
  to authenticated
  using (is_coordinator());

create policy hashlama_registrations_delete_coordinator
  on hashlama_registrations for delete
  to authenticated
  using (is_coordinator());
