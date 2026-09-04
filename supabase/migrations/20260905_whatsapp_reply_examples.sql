-- WhatsApp reply-suggestion engine, round 3: real question→answer examples
-- so Gemini learns the team's actual tone, not just the dry facts in
-- lib/whatsapp-knowledge.ts. Managed from /admin/coordinator/whatsapp-examples
-- (plain client CRUD — no service-role route needed, same as `leads`: RLS
-- itself is the only gate, open to any authenticated coordinator/admin).
--
-- Deactivate (active=false) rather than delete when an example goes stale —
-- keeps the history instead of losing it, per the spec.

create table if not exists whatsapp_reply_examples (
  id            uuid primary key default gen_random_uuid(),
  question_text text not null,
  answer_text   text not null,
  category      text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table whatsapp_reply_examples enable row level security;

drop policy if exists "whatsapp_reply_examples_auth_all" on whatsapp_reply_examples;
create policy "whatsapp_reply_examples_auth_all" on whatsapp_reply_examples
  for all to authenticated using (true) with check (true);
