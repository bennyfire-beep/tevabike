-- Two follow-ups after launch:
-- 1. hashlama_registrations was missing the risk/responsibility consent
--    that hakpatzot_registrations already has — adding it here rather than
--    in the original migration since that one is already applied.
-- 2. Both new registration forms should offer the same WhatsApp marketing
--    opt-in every other public form on the site offers (lib/whatsapp-optin.ts)
--    — hakpatzot_registrations never had it either.
alter table hashlama_registrations
  add column if not exists consent boolean not null default false,
  add column if not exists whatsapp_optin boolean not null default false,
  add column if not exists whatsapp_optin_at timestamptz,
  add column if not exists whatsapp_optin_source text;

alter table hakpatzot_registrations
  add column if not exists whatsapp_optin boolean not null default false,
  add column if not exists whatsapp_optin_at timestamptz,
  add column if not exists whatsapp_optin_source text;
