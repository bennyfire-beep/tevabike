-- Rental: photo of the renter's ID card, required to book (app/rent).
--
-- The image lives in the private rental-contracts bucket (coordinators read,
-- only the server writes), next to the signature. It is personal data, so it
-- is not kept forever: app/api/cron/rental-id-cleanup deletes the file once a
-- booking is closed (returned / cancelled) and ID_PHOTO_RETENTION_DAYS have
-- passed since the rental date, then clears id_photo_path and stamps
-- id_photo_deleted_at so the screen can say the photo was removed and when.
alter table rental_bookings
  add column if not exists id_photo_path text,
  add column if not exists id_photo_sha256 text,
  add column if not exists id_photo_deleted_at timestamptz;
