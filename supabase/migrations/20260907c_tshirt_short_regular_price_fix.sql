-- Correction to the previous short-sleeve shirt price update: regular price
-- should be 180, not 150 (preorder price stays 150).
update tshirt_products
set regular_price = 180, updated_at = now()
where slug = 'short';
