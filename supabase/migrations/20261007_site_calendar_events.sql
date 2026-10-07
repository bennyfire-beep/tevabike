-- Year calendar on the homepage (#classes section), managed from the admin
-- at app/admin/coordinator/calendar. One row = one event; a single-day event
-- leaves end_date null.
--
-- type drives the colour on the site and the legend filter:
--   holiday – חג / חופשה, closed – אין פעילות, competition – תחרות,
--   camp – מחנה / טיול, other – אירוע מיוחד.
create table if not exists site_calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  type text not null default 'other'
    check (type in ('holiday', 'closed', 'competition', 'camp', 'other')),
  title text not null check (length(trim(title)) > 0),
  note text
);

create index if not exists site_calendar_events_start_idx on site_calendar_events (start_date);

alter table site_calendar_events enable row level security;

-- The homepage is a client component that reads with the anon key, and the
-- calendar is public information — so anyone may read, only coordinators
-- may write.
create policy site_calendar_events_select_public on site_calendar_events
  for select using (true);
create policy site_calendar_events_insert_coordinator on site_calendar_events
  for insert to authenticated with check (is_coordinator());
create policy site_calendar_events_update_coordinator on site_calendar_events
  for update to authenticated using (is_coordinator()) with check (is_coordinator());
create policy site_calendar_events_delete_coordinator on site_calendar_events
  for delete to authenticated using (is_coordinator());

-- School year 2026–27, as published in the original calendar page.
insert into site_calendar_events (start_date, end_date, type, title, note) values
  ('2026-09-01', null,         'other',   'תחילת שנת הלימודים', null),
  ('2026-09-11', '2026-09-13', 'closed',  'ראש השנה', 'אין פעילות. חזרה לפעילות ביום ב'' 14/9'),
  ('2026-09-20', '2026-09-21', 'closed',  'יום כיפור', 'אין פעילות. חזרה לפעילות ביום ג'' 22/9'),
  ('2026-09-25', '2026-10-03', 'closed',  'חופשת סוכות', 'אין פעילות. חזרה לפעילות ביום א'' 4/10'),
  ('2026-12-06', '2026-12-12', 'holiday', 'חנוכה', 'מתכונת מיוחדת. חזרה לפעילות ביום א'' 13/12'),
  ('2026-12-06', '2026-12-09', 'camp',    'מחנה חנוכה', null),
  ('2027-03-23', '2027-03-24', 'closed',  'פורים', 'אין פעילות. חזרה לפעילות ביום ה'' 25/3'),
  ('2027-04-13', '2027-04-28', 'holiday', 'פסח', 'מתכונת מיוחדת. חזרה לפעילות ביום ה'' 29/4'),
  ('2027-05-04', null,         'other',   'ערב יום השואה', 'הפעילות תסתיים ב-18:00'),
  ('2027-05-10', null,         'other',   'ערב יום הזיכרון', 'הפעילות תסתיים ב-18:00'),
  ('2027-05-11', '2027-05-12', 'closed',  'יום הזיכרון ויום העצמאות', 'אין פעילות. חזרה לפעילות ביום ה'' 13/5'),
  ('2027-06-10', '2027-06-11', 'closed',  'שבועות', 'אין פעילות. חזרה לפעילות ביום א'' 13/6'),
  ('2027-07-01', null,         'holiday', 'תחילת חופשת הקיץ', null);
