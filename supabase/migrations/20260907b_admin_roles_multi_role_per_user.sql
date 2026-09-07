-- admin_roles is one row per JOB, and the app (lib/roles.ts, login, the
-- instructor screens) has long assumed one person can hold several jobs —
-- coordinator + instructor being the common case — all sharing the same
-- user_id, and every query does `.eq('user_id', ...)` without `.single()`
-- specifically because of this.
--
-- The original schema, however, still carried a UNIQUE constraint on
-- user_id, left over from before multi-role existed. In practice that meant
-- a person's first row claimed their user_id and every other role row for
-- them had to sit with user_id left null — undiscoverable by the very
-- `.eq('user_id', auth.uid())` lookups every screen uses, so their
-- second/third role silently never worked. Discovered via בני להט and טל
-- ברקן: both have a coordinator row (user_id set) and an instructor row
-- (user_id null) — neither could ever open /admin/instructor, which is
-- where the ★ גפן tab (20260907_gefen_special_activity.sql) lives.
--
-- Drop the uniqueness, keep a plain (non-unique) index — every lookup here
-- is `.eq('user_id', ...)`, so the index still earns its keep.
alter table public.admin_roles drop constraint if exists admin_roles_user_id_key;
create index if not exists admin_roles_user_id_idx on public.admin_roles (user_id);

-- Link the two existing instructor rows to the same auth users their
-- coordinator rows already use, so /admin/instructor resolves them.
update public.admin_roles
   set user_id = 'b0bd8d88-c8f0-4e7a-91e0-362e0247385f'  -- בני להט
 where id = '71505ef8-ad76-40f7-91b6-291da09dc09b'
   and role = 'instructor';

update public.admin_roles
   set user_id = '9f942d4e-898a-457f-96bb-44bae5488015'  -- טל ברקן
 where id = 'f12f3570-49db-46f8-be77-6312c49dcdef'
   and role = 'instructor';
