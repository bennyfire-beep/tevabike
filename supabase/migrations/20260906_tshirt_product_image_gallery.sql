-- Products now carry a gallery (front/back/side, etc.) instead of a single
-- photo — Benny wants the real product shots (front+back+side) shown on
-- /shop, not just one image per shirt. image_url is kept (harmless) for any
-- code that still reads it, but the UI now reads image_urls exclusively.
-- Existing single-image products are backfilled so nothing goes blank.
alter table tshirt_products
  add column if not exists image_urls text[] not null default '{}';

update tshirt_products
set image_urls = array[image_url]
where image_url is not null and image_urls = '{}';
