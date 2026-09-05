-- Whole-section on/off switch for the t-shirt tab on /shop, separate from
-- tshirt_products.preorder_active (which only toggles one product's
-- preorder→regular price). Benny wants the tab visible but showing "coming
-- soon" until the final shirt designs are ready — not per-product, the whole
-- section. Modeled as a one-row settings table (not a plain constant) so he
-- can flip it from the admin panel without a deploy, same reasoning as
-- tshirt_products.
create table if not exists tshirt_shop_settings (
  id boolean primary key default true check (id), -- enforces a single row
  is_active boolean not null default false,
  coming_soon_message text not null default 'בקרוב! עובדים על העיצוב הסופי של החולצות.',
  updated_at timestamptz not null default now()
);

insert into tshirt_shop_settings (id, is_active)
values (true, false)
on conflict (id) do nothing;

alter table tshirt_shop_settings enable row level security;

-- Public read — /shop needs this without an authenticated session.
create policy tshirt_shop_settings_select_public
  on tshirt_shop_settings for select
  using (true);

-- Only staff (admin panel) can flip it.
create policy tshirt_shop_settings_update_authenticated
  on tshirt_shop_settings for update
  to authenticated
  using (true)
  with check (true);
