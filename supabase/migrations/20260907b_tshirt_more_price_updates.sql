-- Follow-up price update requested by Benny: bring the plain long-sleeve
-- shirt up to match the TvB gradient one, and set the short-sleeve shirt to
-- a flat 150 (preorder == regular, i.e. no discount on it going forward).
update tshirt_products
set preorder_price = 180, regular_price = 220, updated_at = now()
where slug = 'long_plain';

update tshirt_products
set preorder_price = 150, regular_price = 150, updated_at = now()
where slug = 'short';
