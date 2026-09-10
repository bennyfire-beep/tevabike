-- Batch A: tighten "authenticated = true" policies to "authenticated AND
-- is_coordinator()" on tables that are exclusively consumed from
-- /admin/coordinator/* pages (confirmed via grep — no instructor/student
-- flow reads these). is_coordinator() is the same function already gating
-- registrations/camp_registrations/sukkot_registrations DELETE and
-- class_sessions DELETE in production, so this is not a new mechanism —
-- it's applying the one already proven correct to SELECT/UPDATE/DELETE
-- policies that were left at using(true).
--
-- Nothing here is destructive: no table, column, or row is dropped. A
-- coordinator (Benny/Shir/Tal) keeps every permission they have today.
-- What changes: a non-coordinator authenticated user (an instructor or a
-- rider/parent logged into /student) can no longer read or write these
-- rows via a direct PostgREST call.

-- groups: delete was the one policy in this family still wide open
alter policy coordinator_delete_groups on public.groups
  using (is_coordinator());

-- registrations
alter policy reg_read on public.registrations
  using (is_coordinator());
alter policy reg_update on public.registrations
  using (is_coordinator()) with check (is_coordinator());

-- camp_registrations
alter policy camp_reg_read on public.camp_registrations
  using (is_coordinator());
alter policy camp_reg_update on public.camp_registrations
  using (is_coordinator()) with check (is_coordinator());

-- sukkot_registrations
alter policy sukkot_reg_read on public.sukkot_registrations
  using (is_coordinator());
alter policy sukkot_reg_update on public.sukkot_registrations
  using (is_coordinator()) with check (is_coordinator());

-- workshop_registrations (drop the redundant duplicate select policy,
-- tighten the remaining one + the update policy)
drop policy if exists workshop_regs_select_auth on public.workshop_registrations;
alter policy workshop_regs_select_authenticated on public.workshop_registrations
  using (is_coordinator());
alter policy workshop_regs_update_authenticated on public.workshop_registrations
  using (is_coordinator()) with check (is_coordinator());

-- payment_alerts (financial/churn data)
alter policy payment_alerts_read on public.payment_alerts
  using (is_coordinator());
alter policy payment_alerts_update on public.payment_alerts
  using (is_coordinator()) with check (is_coordinator());

-- push_subscriptions (Web Push endpoint/keys — real secrets)
alter policy push_subscriptions_select on public.push_subscriptions
  using (is_coordinator());

-- staff birthdays
alter policy staff_birthdays_select on public.staff_birthdays
  using (is_coordinator());
alter policy staff_birthday_alerts_select on public.staff_birthday_alerts
  using (is_coordinator());

-- whatsapp CRM helper tables
alter policy whatsapp_reply_examples_auth_all on public.whatsapp_reply_examples
  using (is_coordinator()) with check (is_coordinator());
alter policy whatsapp_suggestions_select on public.whatsapp_suggestions
  using (is_coordinator());

-- absence_alerts (children's attendance-gap data)
alter policy absence_alerts_auth_all on public.absence_alerts
  using (is_coordinator()) with check (is_coordinator());

-- tshirt_orders (customer PII, was even DELETE-able by anyone authenticated)
alter policy tshirt_orders_select_authenticated on public.tshirt_orders
  using (is_coordinator());
alter policy tshirt_orders_update_authenticated on public.tshirt_orders
  using (is_coordinator()) with check (is_coordinator());
alter policy tshirt_orders_delete_authenticated on public.tshirt_orders
  using (is_coordinator());

-- shop_cancellation_requests
alter policy shop_cancellation_requests_select_authenticated on public.shop_cancellation_requests
  using (is_coordinator());
alter policy shop_cancellation_requests_update_authenticated on public.shop_cancellation_requests
  using (is_coordinator()) with check (is_coordinator());

-- shop_orders (customer PII/addresses)
alter policy shop_orders_select_authenticated on public.shop_orders
  using (is_coordinator());
alter policy shop_orders_update_authenticated on public.shop_orders
  using (is_coordinator()) with check (is_coordinator());

-- community_contacts, leads, content_queue — not read by any app code
-- outside /admin/coordinator/* (grep-verified); tightened for defense in
-- depth even though nothing currently exercises the open path.
alter policy community_contacts_select_authenticated on public.community_contacts
  using (is_coordinator());
alter policy community_contacts_update_authenticated on public.community_contacts
  using (is_coordinator()) with check (is_coordinator());
alter policy leads_auth_all on public.leads
  using (is_coordinator()) with check (is_coordinator());
alter policy content_queue_auth_all on public.content_queue
  using (is_coordinator()) with check (is_coordinator());
