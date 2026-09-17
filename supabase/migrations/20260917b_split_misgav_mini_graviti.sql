-- Split מיני גרביטי/משגב into two groups (א/ב) — the existing group had 34
-- riders assigned against a max_riders of 15, which Benny is splitting in
-- two so each half gets its own attendance register. Renames the existing
-- group to א and adds a matching new group ב (same branch/schedule/level);
-- which riders land in which group is Benny's own call, done afterwards in
-- /admin/coordinator/students — this migration only creates the container.
--
-- Applied directly to the live database; tracked here for the record.

update public.groups
set name = 'מיני גרביטי א'
where id = '2f09173d-f7d9-428e-b47c-c10f363a83db';

insert into public.groups (name, branch, level, days, start_time, end_time, type, max_riders, is_active, days_of_week)
values ('מיני גרביטי ב', 'משגב', 'מתחילים', 'ראשון, חמישי', '15:30', '17:00', 'kids', 15, true, array[0,4]::smallint[]);
