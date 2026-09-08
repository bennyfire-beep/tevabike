-- צורית-גילון is a real branch/fixed track (app/register/page.tsx GILON_BRANCH,
-- Tuesday 14:45-15:45, kids-only, ₪270, instructor ארז דגן) that never got a
-- row in `groups`, so it never showed up on the coordinator attendance
-- screen's "בחר קבוצה" list when opening a new session — the same gap
-- 'פרוד-אמירים' had before it was added (see the branch-day-flow-fix commit).
--
-- Applied directly to the live database; recorded here for history/repro.
alter table public.groups drop constraint if exists groups_branch_check;
alter table public.groups add constraint groups_branch_check
  check (branch = any (array['משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'צורית-גילון', 'כללי']));

insert into public.groups (name, branch, level, days, start_time, end_time, type, days_of_week, max_riders, is_active)
values ('גילון', 'צורית-גילון', 'מתקדם', 'שלישי 14:45–15:45', '14:45', '15:45', 'kids', array[2]::smallint[], 15, true);
