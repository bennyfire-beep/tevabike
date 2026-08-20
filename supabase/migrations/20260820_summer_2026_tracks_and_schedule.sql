-- Summer 2026: two-track pricing, Sunday+Thursday at Misgav, no Friday classes.
--
-- This extends the tables that are already in production rather than adding a
-- parallel set. Mapping from the spec to what actually exists:
--   students     -> public.riders          (162 rows)
--   lessons      -> public.class_sessions  (10 rows)
--   instructors  -> public.admin_roles (role='instructor') + public.staff_pay
--   groups       -> public.groups          (15 rows, 8 FKs point at it)
--   attendance   -> public.attendance      (41 rows)
-- Creating new students/lessons/instructors tables would have split the live
-- data in two, so only the genuinely missing columns are added here.

-- ── groups: machine-readable day list next to the existing free-text `days` ──
-- The text column stays untouched so the current coordinator screens keep
-- rendering exactly as they do now. 0 = Sunday .. 6 = Saturday.
alter table public.groups
  add column if not exists days_of_week smallint[] not null default '{}';

-- ── riders: which track a student is on and what they pay ───────────────────
alter table public.riders
  add column if not exists track text
    check (track is null or track in ('once_weekly', 'twice_weekly'));
alter table public.riders
  add column if not exists chosen_day smallint
    check (chosen_day is null or chosen_day between 0 and 6);
alter table public.riders
  add column if not exists monthly_price numeric;

-- ── staff_pay: per-lesson rate used by the salaries report ──────────────────
alter table public.staff_pay
  add column if not exists rate_per_lesson numeric not null default 150;

-- ── registrations: the public form now collects track + chosen day ─────────
-- membership_plan keeps its existing CHECK ('center'/'yomoadon'/'combined') so
-- historical rows stay valid; new kids registrations all come in as 'center'
-- and the track carries the price distinction.
alter table public.registrations
  add column if not exists track text
    check (track is null or track in ('once_weekly', 'twice_weekly'));
alter table public.registrations
  add column if not exists chosen_day smallint
    check (chosen_day is null or chosen_day between 0 and 6);

-- ── Backfill days_of_week from the existing Hebrew day text ─────────────────
update public.groups g
set days_of_week = coalesce((
  select array_agg(m.d order by m.d)
  from (values ('ראשון',0),('שני',1),('שלישי',2),('רביעי',3),
               ('חמישי',4),('שישי',5),('שבת',6)) as m(nm, d)
  where g.days like '%' || m.nm || '%'
), '{}');

-- ── Misgav kids groups move to Sunday + Thursday, 15:30-17:00 ───────────────
update public.groups
set days         = 'ראשון, חמישי',
    days_of_week = '{0,4}',
    start_time   = '15:30',
    end_time     = '17:00',
    is_active    = true
where branch = 'משגב'
  and type   = 'kids'
  and name in ('מיני גרביטי', 'גרביטי מתחילים', 'גרביטי פרו');

-- The separate Thursday-only Pro group is redundant now that Pro runs both days.
update public.groups
set is_active = false
where branch = 'משגב' and name = 'גרביטי פרו חמישי';

-- ── Friday classes are cancelled entirely ──────────────────────────────────
-- Deactivated, not deleted: attendance and registrations reference these rows.
update public.groups
set is_active = false
where 5 = any(days_of_week);

-- ── Retroactive pay fix for special activities ─────────────────────────────
-- lib/attendance.ts read hourly_rate off admin_roles, where the column does not
-- exist. PostgREST returned an error, the payload came back null, and every
-- special activity was stored at ₪0. The rates were always correct in
-- staff_pay; only the read was wrong. Recompute the affected sessions.
update public.class_sessions cs
set instructor_pay = round(coalesce(cs.duration, 0) * sub.sum_rate, 2)
from (
  select cs2.id,
         sum(coalesce(sp.hourly_rate, 90)) as sum_rate
  from public.class_sessions cs2
  cross join lateral unnest(
    case
      when cs2.instructor_ids is not null and array_length(cs2.instructor_ids, 1) > 0
        then cs2.instructor_ids
      when cs2.instructor_id is not null
        then array[cs2.instructor_id]
      else '{}'::uuid[]
    end
  ) as ins(instructor_id)
  left join public.staff_pay sp on sp.admin_role_id = ins.instructor_id
  where cs2.type = 'special'
  group by cs2.id
) as sub
where cs.id = sub.id
  and cs.type = 'special'
  and coalesce(cs.instructor_pay, 0) = 0;

-- ── RLS: rounding out admin access on the two tables missing DELETE ─────────
-- groups, riders, attendance, class_sessions, admin_roles and staff_pay all
-- already carry authenticated SELECT/INSERT/UPDATE policies.
drop policy if exists coordinator_delete_groups on public.groups;
create policy coordinator_delete_groups on public.groups
  for delete to authenticated using (true);

drop policy if exists coordinator_delete_sessions on public.class_sessions;
create policy coordinator_delete_sessions on public.class_sessions
  for delete to authenticated using (true);
