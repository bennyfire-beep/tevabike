-- Free-form tags per WhatsApp conversation (e.g. "לקוח", "מתעניין", "צוות",
-- "ספק", "VIP") so the coordinator inbox can be filtered like a real CRM —
-- same idea as the label chips on agents.lahat.group. No fixed vocabulary
-- table on purpose: the coordinator types whatever tag she needs, the UI just
-- suggests the ones already in use elsewhere (see PRESET_TAGS in the page).
--
-- Written and read only through /api/whatsapp/tags and /api/whatsapp/conversations
-- (service role) — same pattern as assigned_to, so no new RLS policy is
-- needed here: the existing whatsapp_conversations_select/update policies
-- already govern the whole row, tags included.
alter table whatsapp_conversations add column if not exists tags text[] not null default '{}';

-- Powers "which tags exist right now" (for the filter chips) and any future
-- "find everyone tagged X" query without a full table scan.
create index if not exists whatsapp_conversations_tags_idx on whatsapp_conversations using gin (tags);
