-- Benny confirmed the IXS Carve knee guards ship through Fun Ride like the
-- other SPANK accessories (delivery + supplier order + tracking), not
-- self-pickup like shirts. That automation only exists on the shop_orders/
-- PRODUCTS pipeline (app/shop/page.tsx + app/api/shop-order), so the product
-- moved there instead (with its already-uploaded photo and real Arbox link
-- carried over as hardcoded values) and no longer belongs in tshirt_products
-- — leaving it here too would let someone edit price/image from the
-- tshirt-orders admin panel without it having any effect on the live site.
-- No orders ever referenced this slug (checked before deleting).
delete from tshirt_products where slug = 'ixs_carve_2_knee_guards';
