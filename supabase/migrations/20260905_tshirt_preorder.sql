-- Tevabike-branded t-shirt pre-order section for /shop (second tab, next to
-- the existing SPANK accessories). Not dropshipping — shirts are printed in
-- one batch and picked up in person at the club, so there's no supplier
-- notification flow here (unlike shop_orders).
--
-- tshirt_products is deliberately a DB table, not a hardcoded array like
-- PRODUCTS in app/shop/page.tsx — Benny asked for the preorder→regular price
-- switch to be a manual admin toggle he can flip without a deploy, and the
-- real Arbox links aren't ready yet, so he needs somewhere to paste them in
-- later from the admin panel. preorder_active only matters for products that
-- actually have two price points; for the named long-sleeve (fixed 250₪
-- always, per Benny) it's left off and regular_price/regular_arbox_link is
-- simply the one price used at all times.
create table if not exists tshirt_products (
  slug text primary key,
  name text not null,
  description text,
  image_url text,
  sizes text[] not null default array['XXS','XS','S','M','L','XL','XXL','XXXL'],
  requires_back_name boolean not null default false,
  preorder_price numeric not null,
  regular_price numeric not null,
  preorder_active boolean not null default false,
  preorder_arbox_link text,
  regular_arbox_link text,
  -- Free text shown on-site ("בתוקף עד ..."), e.g. '1.11.2026'. Purely
  -- informational — preorder_active (above) is what actually switches the
  -- price/link, per Benny's call to keep that a manual toggle rather than an
  -- automatic date check.
  preorder_deadline_label text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tshirt_products enable row level security;

-- Public read — /shop needs prices/links/toggle state without an authenticated session.
create policy tshirt_products_select_public
  on tshirt_products for select
  using (true);

-- Only staff (admin panel) can edit prices, links or the preorder toggle.
create policy tshirt_products_update_authenticated
  on tshirt_products for update
  to authenticated
  using (true)
  with check (true);

insert into tshirt_products
  (slug, name, description, requires_back_name, preorder_price, regular_price, preorder_active, preorder_deadline_label, display_order)
values
  ('long_named', 'חולצה ארוכה עם שם על הגב', 'עיצוב טבע בייק · שרוול ארוך · שם באנגלית על הגב', true, 250, 250, false, null, 1),
  ('long_plain', 'חולצה ארוכה', 'עיצוב טבע בייק · שרוול ארוך', false, 150, 200, true, '1.11.2026', 2),
  ('short', 'חולצה קצרה', 'עיצוב טבע בייק · שרוול קצר', false, 120, 150, true, '1.11.2026', 3)
on conflict (slug) do nothing;

-- One row per line item (type+size+back name+quantity) — an order can
-- contain several lines sharing an order_group, same shape as shop_orders,
-- since a customer can order any quantity across sizes (e.g. for family).
create table if not exists tshirt_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  order_group text not null,
  product_slug text not null references tshirt_products(slug),
  product_name text not null,
  size text not null check (size in ('XXS','XS','S','M','L','XL','XXL','XXXL')),
  back_name text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric not null,
  is_preorder boolean not null default false,
  line_total numeric not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed')),
  staff_notes text
);

alter table tshirt_orders enable row level security;

-- Same RLS shape as shop_orders/shop_cancellation_requests: staff can
-- read/update/delete from the admin panel; insert only via the service-role
-- API route (no public insert policy).
create policy tshirt_orders_select_authenticated
  on tshirt_orders for select
  to authenticated
  using (true);

create policy tshirt_orders_update_authenticated
  on tshirt_orders for update
  to authenticated
  using (true)
  with check (true);

create policy tshirt_orders_delete_authenticated
  on tshirt_orders for delete
  to authenticated
  using (true);
