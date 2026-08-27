-- WhatsApp CRM: conversations + messages, fed by the Meta Cloud API webhook
-- (app/api/whatsapp/webhook) and read/written by the coordinator screen at
-- /admin/coordinator/whatsapp.
--
-- All reads and writes go through API routes running with the service role —
-- the browser never talks to these tables directly with the anon key, and the
-- API routes check admin_roles for coordinator/admin themselves (see
-- app/api/whatsapp/*). So the authenticated policy below is a defence-in-depth
-- backstop, not the real enforcement — same shape as the live admin_roles
-- policies (`admin_roles_select` is `using (true)` for any authenticated
-- user; there is no get_admin_role() in this project despite schema.sql).

create table if not exists whatsapp_conversations (
  id               uuid primary key default gen_random_uuid(),
  wa_id            text unique not null,          -- e.g. 972525708084
  display_name     text,                          -- contacts[0].profile.name from the last inbound message
  last_message_at  timestamptz,
  last_inbound_at  timestamptz,                   -- drives the 24h reply-window check
  unread_count     int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists whatsapp_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references whatsapp_conversations(id),
  wa_message_id    text unique,                   -- Meta's id; dedupes retried webhook deliveries
  direction        text not null check (direction in ('inbound', 'outbound')),
  msg_type         text,                          -- text / image / audio / document / sticker / location / unsupported ...
  body             text,                          -- text content, or a short label for non-text types
  status           text,                          -- sent / delivered / read / failed (outbound only, from status webhooks)
  error_detail     text,
  created_at       timestamptz not null default now()
);

create index if not exists whatsapp_messages_conversation_created_idx
  on whatsapp_messages (conversation_id, created_at);

alter table whatsapp_conversations enable row level security;
alter table whatsapp_messages       enable row level security;

drop policy if exists "whatsapp_conversations_select" on whatsapp_conversations;
create policy "whatsapp_conversations_select" on whatsapp_conversations
  for select to authenticated using (true);

drop policy if exists "whatsapp_conversations_service_write" on whatsapp_conversations;
create policy "whatsapp_conversations_service_write" on whatsapp_conversations
  for all to service_role using (true) with check (true);

drop policy if exists "whatsapp_messages_select" on whatsapp_messages;
create policy "whatsapp_messages_select" on whatsapp_messages
  for select to authenticated using (true);

drop policy if exists "whatsapp_messages_service_write" on whatsapp_messages;
create policy "whatsapp_messages_service_write" on whatsapp_messages
  for all to service_role using (true) with check (true);
