-- tshirt_products has grown beyond actual t-shirts (pants, now IXS Carve
-- knee guards) and Benny wants the guards shown under the "אביזרים" tab on
-- /shop instead of "ביגוד" — both tabs now render from this table, split by
-- category, rather than moving the guards into the hardcoded PRODUCTS array
-- in app/shop/page.tsx (which has no size support and a combo-checkout model
-- that doesn't generalize to a 4th product).
alter table tshirt_products
  add column if not exists category text not null default 'clothing'
    check (category in ('clothing', 'accessories'));

update tshirt_products
set category = 'accessories'
where slug = 'ixs_carve_2_knee_guards';
