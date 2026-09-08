-- Storage bucket for product photos uploaded from the admin panel (tshirt/
-- gear products whose image_urls[] would otherwise need a code deploy —
-- e.g. IXS Carve 2.0 knee guards, added with no photo yet). Public read so
-- /shop can render straight from the returned URL; upload/delete restricted
-- to logged-in staff (same shape as the jump-clips bucket in tricktrack).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_staff_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "product_images_staff_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
