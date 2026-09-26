-- per-trip reminder schedule overrides + equipment-email meeting invite
-- milestone_days: {"equipment": 78, "flights": null} — number overrides days, null disables
alter table trips add column if not exists milestone_days jsonb;
alter table trips add column if not exists equipment_workshop_note text;
-- locked per-registrant price (early bird) — already applied in production
alter table trip_registrations add column if not exists package_price_ils numeric;
