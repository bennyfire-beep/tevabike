-- Self-service order-cancellation requests from /shop/cancel.
--
-- This never moves money by itself — Arbox payment links aren't
-- integrated with our backend (no webhook back to us), so every
-- refund still happens manually inside the Arbox dashboard. This
-- table just gives the request a timestamped record, a best-effort
-- match against the matching shop_orders row(s) (to estimate the
-- 14-day window and the cancellation fee), and something to alert
-- Benny about by email. Same RLS shape as shop_orders: authenticated
-- staff can read/update (e.g. from the Supabase dashboard or a future
-- admin page); insert only via the service-role API route.

create table if not exists shop_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text not null,
  customer_phone text not null,
  order_reference text, -- free text the customer typed (order id / description), if any
  reason text not null check (reason in ('not_wanted', 'defective', 'other')),
  reason_details text,
  -- Best-effort match against shop_orders by phone at request time — null if no match found.
  matched_order_id uuid references shop_orders(id),
  matched_order_created_at timestamptz,
  matched_order_total numeric,
  days_since_order integer,
  eligible_14_day_window boolean,
  estimated_fee numeric,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'refunded')),
  staff_notes text
);

alter table shop_cancellation_requests enable row level security;

create policy shop_cancellation_requests_select_authenticated
  on shop_cancellation_requests for select
  to authenticated
  using (true);

create policy shop_cancellation_requests_update_authenticated
  on shop_cancellation_requests for update
  to authenticated
  using (true)
  with check (true);
