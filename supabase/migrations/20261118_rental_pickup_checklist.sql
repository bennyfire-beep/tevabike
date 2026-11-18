-- Pre-ride checklist: the renter checks each bike at pickup (brakes, motor,
-- wheels...) from the link in the booking email (app/rent/checklist). A "no"
-- on any item sends the rider to the Timo Pan shop before riding out.
alter table rental_booking_items
  add column if not exists checklist jsonb,          -- { item_id: true|false, note?: text }
  add column if not exists checklist_ok boolean,      -- all items true
  add column if not exists checklist_at timestamptz;  -- last submission
