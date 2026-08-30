-- WhatsApp consent on the annual /register form: a checked box lets us send
-- one pre-approved confirmation template right after the registration is
-- saved, so the customer's reply opens a conversation in
-- /admin/coordinator/whatsapp. See lib/whatsapp-templates.ts — sending stays
-- a safe no-op until WHATSAPP_REGISTRATION_TEMPLATE_NAME is set.

alter table registrations add column if not exists whatsapp_consent boolean not null default false;
alter table registrations add column if not exists whatsapp_confirmation_sent_at timestamptz;
