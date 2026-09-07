-- Price update requested by Benny: raise the "TvB gradient" long-sleeve
-- shirt and the TvB pants to new preorder/regular price points. Both
-- products already have preorder_active = true (two price points), so this
-- only touches the numbers, not the toggle.
update tshirt_products
set preorder_price = 180, regular_price = 220, updated_at = now()
where slug = 'long_tvb_gradient';

update tshirt_products
set preorder_price = 430, regular_price = 460, updated_at = now()
where slug = 'pants_tvb';
