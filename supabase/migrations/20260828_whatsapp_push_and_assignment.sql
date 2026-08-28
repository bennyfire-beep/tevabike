-- WhatsApp CRM, round 2: push subscriptions, conversation assignment, and
-- who-sent-what — for the coordinator PWA + notifications + Tal sharing the
-- inbox without seeing every conversation.

-- ── Push subscriptions (Web Push / VAPID) ──────────────────────────────────
-- One row per browser the person enabled notifications in (a phone and a
-- desktop count as two). Real enforcement is the /api/push/* routes running
-- with the service role, same shape as the whatsapp tables — the browser
-- never reads or writes this table directly.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_email  text not null,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on push_subscriptions;
create policy "push_subscriptions_select" on push_subscriptions
  for select to authenticated using (true);

drop policy if exists "push_subscriptions_service_write" on push_subscriptions;
create policy "push_subscriptions_service_write" on push_subscriptions
  for all to service_role using (true) with check (true);

-- ── Conversation assignment ─────────────────────────────────────────────────
-- assigned_to is the team member's email (nullable = unassigned / shared).
alter table whatsapp_conversations add column if not exists assigned_to text;
alter table whatsapp_conversations add column if not exists assigned_at timestamptz;

-- ── Who sent an outbound message ────────────────────────────────────────────
-- The signature ("— טל") is appended to the text actually sent to the
-- customer (see app/api/whatsapp/send); this column is the same name, kept
-- separately so the UI can show it without re-parsing the message body.
alter table whatsapp_messages add column if not exists sent_by text;

-- ── Assignment-aware visibility ─────────────────────────────────────────────
-- admin sees every conversation; coordinator sees her own assigned
-- conversations plus anything unassigned, and nobody else's. This is a
-- backstop, same as the rest of this feature — the browser never queries
-- these tables with the anon/authenticated key, every real read and write
-- goes through /api/whatsapp/* running with the service role, which applies
-- the identical rule in application code (see lib/whatsapp-server.ts).
drop policy if exists "whatsapp_conversations_select" on whatsapp_conversations;
create policy "whatsapp_conversations_select" on whatsapp_conversations
  for select to authenticated
  using (
    exists (select 1 from admin_roles ar where ar.user_id = auth.uid() and ar.role = 'admin')
    or (
      exists (select 1 from admin_roles ar where ar.user_id = auth.uid() and ar.role = 'coordinator')
      and (assigned_to is null or lower(assigned_to) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  );

-- A message is visible exactly when its conversation is — re-running the
-- exists() against whatsapp_conversations re-applies that table's own RLS,
-- so the rule above is the only place the logic has to live.
drop policy if exists "whatsapp_messages_select" on whatsapp_messages;
create policy "whatsapp_messages_select" on whatsapp_messages
  for select to authenticated
  using (
    exists (select 1 from whatsapp_conversations c where c.id = whatsapp_messages.conversation_id)
  );
