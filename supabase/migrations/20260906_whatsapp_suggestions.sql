-- WhatsApp reply-suggestion log: one row per Gemini draft offered to a
-- coordinator at /admin/coordinator/whatsapp (app/api/whatsapp/suggest),
-- plus the stage-3 outcome flag the spec asks for — "אושרה כמו שהיא" /
-- "נערכה" / "נדחתה" — so accuracy can be measured once the live test period
-- (stage 3) has run a few days, without any UI beyond the three buttons on
-- the suggestion card itself.
--
-- outcome is set by:
--   - app/api/whatsapp/send: sent_as_is (the "שלח" button — the suggestion
--     text went out unchanged) or edited (the "ערוך" button — the coordinator
--     opened it in the composer, changed it, then sent).
--   - app/api/whatsapp/suggestions/reject: rejected (the "דחה" button —
--     dismissed without sending).
-- A suggestion the coordinator simply ignored (typed their own reply without
-- touching the card) stays outcome = null — undecided, not "rejected".
--
-- Same RLS shape as whatsapp_conversations/whatsapp_messages: all reads and
-- writes go through /api/whatsapp/* routes running with the service role;
-- the authenticated-select policy is a defence-in-depth backstop.

create table if not exists whatsapp_suggestions (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null references whatsapp_conversations(id) on delete cascade,
  -- The inbound message this was drafted in reply to, when the conversation's
  -- most recent message was inbound (unanswered) at suggestion time.
  inbound_message_id   uuid references whatsapp_messages(id) on delete set null,
  suggested_text       text not null default '',   -- '' when unsure
  category             text,                       -- price / dates / availability / hours / registration_link / other
  unsure               boolean not null default false,
  -- 'auto_sent' = stage 4: sent straight to the customer with no coordinator
  -- involved at all (see lib/whatsapp-autoreply.ts) — decided_by is 'bot' for these.
  outcome              text check (outcome in ('sent_as_is', 'edited', 'rejected', 'auto_sent')),
  final_text           text,                       -- what was actually sent, for the 'edited' case
  outbound_message_id  uuid references whatsapp_messages(id) on delete set null,
  decided_by           text,
  decided_at           timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists whatsapp_suggestions_conversation_created_idx
  on whatsapp_suggestions (conversation_id, created_at);

alter table whatsapp_suggestions enable row level security;

drop policy if exists "whatsapp_suggestions_select" on whatsapp_suggestions;
create policy "whatsapp_suggestions_select" on whatsapp_suggestions
  for select to authenticated using (true);

drop policy if exists "whatsapp_suggestions_service_write" on whatsapp_suggestions;
create policy "whatsapp_suggestions_service_write" on whatsapp_suggestions
  for all to service_role using (true) with check (true);
