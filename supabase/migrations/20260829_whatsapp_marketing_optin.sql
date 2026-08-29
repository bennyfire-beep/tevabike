-- WhatsApp marketing opt-in — every public form that collects a phone number
-- (contact, youth-group registration, both camps, the airbag workshop) now
-- carries an optional consent checkbox so approved templates can be sent
-- later. Same three columns on each source table, so the coordinator screens
-- and the public API routes can treat them identically:
--   whatsapp_optin        boolean      — false unless the visitor checked the box
--   whatsapp_optin_at     timestamptz  — when they checked it (null if not)
--   whatsapp_optin_source text         — which form it came from (null if not)
--
-- Existing rows default to whatsapp_optin = false / no timestamp / no source —
-- nobody is opted in retroactively.

alter table public.leads
  add column if not exists whatsapp_optin boolean not null default false;
alter table public.leads
  add column if not exists whatsapp_optin_at timestamptz;
alter table public.leads
  add column if not exists whatsapp_optin_source text;

alter table public.registrations
  add column if not exists whatsapp_optin boolean not null default false;
alter table public.registrations
  add column if not exists whatsapp_optin_at timestamptz;
alter table public.registrations
  add column if not exists whatsapp_optin_source text;

alter table public.camp_registrations
  add column if not exists whatsapp_optin boolean not null default false;
alter table public.camp_registrations
  add column if not exists whatsapp_optin_at timestamptz;
alter table public.camp_registrations
  add column if not exists whatsapp_optin_source text;

alter table public.sukkot_registrations
  add column if not exists whatsapp_optin boolean not null default false;
alter table public.sukkot_registrations
  add column if not exists whatsapp_optin_at timestamptz;
alter table public.sukkot_registrations
  add column if not exists whatsapp_optin_source text;

alter table public.workshop_registrations
  add column if not exists whatsapp_optin boolean not null default false;
alter table public.workshop_registrations
  add column if not exists whatsapp_optin_at timestamptz;
alter table public.workshop_registrations
  add column if not exists whatsapp_optin_source text;
