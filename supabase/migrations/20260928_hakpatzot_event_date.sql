-- Shuttle days now run in rounds with several dates each (first: 9.10 and
-- 16.10, 15 riders per date). Registrations are tagged with the date they
-- are for; the cap is counted per date. Rows from the original one-off
-- Misgav-Yaad day keep event_date null and stay as history — the app only
-- counts the dates listed in lib/hakpatzot.ts, which is what "resets" the
-- registration for a new round without deleting anything.
alter table hakpatzot_registrations add column if not exists event_date date;

create index if not exists hakpatzot_registrations_event_date_idx
  on hakpatzot_registrations (event_date, created_at);
