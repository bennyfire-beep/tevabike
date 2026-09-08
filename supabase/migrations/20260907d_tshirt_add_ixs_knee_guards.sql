-- New product requested by Benny: IXS Carve 2.0 knee/leg guards. Single
-- price point (no preorder discount) — preorder_price == regular_price and
-- preorder_active = false, same pattern as long_named. No product photo yet
-- (image_urls left empty — UI shows "תמונה בקרוב" until Benny uploads one
-- via the admin panel), and no Arbox payment link yet either.
insert into tshirt_products
  (slug, name, description, requires_back_name, sizes, preorder_price, regular_price, preorder_active, display_order)
values
  ('ixs_carve_2_knee_guards', 'מגיני רגל IXS CARVE 2.0', 'מגיני ברך/שוק IXS Carve 2.0', false,
   array['S', 'M', 'L', 'XL'], 550, 550, false, 6)
on conflict (slug) do nothing;
