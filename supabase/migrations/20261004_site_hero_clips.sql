-- Background-video clips for page heroes, managed from the admin
-- (app/admin/coordinator/hero-videos) instead of re-encoding files by hand.
-- First used by /rides (page = 'rides').
--
-- Nothing is transcoded: the browser plays each clip as uploaded, from
-- start_s to end_s, and frames it with CSS object-position — focus_desktop /
-- focus_mobile are the vertical focus (0 = top of the frame, 100 = bottom)
-- for the wide desktop header and the tall phone header respectively, since
-- phone videos are usually shot upright and each layout shows a different
-- band of the frame.
--
-- url is what the page plays: either a Storage public URL (storage_path set,
-- so the admin can delete the file with the row) or a static file under
-- /public (storage_path null — the clips that shipped with the site).
create table if not exists site_hero_clips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page text not null default 'rides',
  label text,
  url text not null,
  storage_path text,
  sort int not null default 0,
  active boolean not null default true,
  start_s numeric not null default 0 check (start_s >= 0),
  end_s numeric check (end_s is null or end_s > start_s),
  focus_desktop int not null default 50 check (focus_desktop between 0 and 100),
  focus_mobile int not null default 50 check (focus_mobile between 0 and 100)
);

create index if not exists site_hero_clips_page_sort_idx on site_hero_clips (page, sort);

alter table site_hero_clips enable row level security;

-- The public page reads through the service role (server component), so
-- only coordinators need policies — same convention as the registrations.
create policy site_hero_clips_select_coordinator on site_hero_clips
  for select to authenticated using (is_coordinator());
create policy site_hero_clips_insert_coordinator on site_hero_clips
  for insert to authenticated with check (is_coordinator());
create policy site_hero_clips_update_coordinator on site_hero_clips
  for update to authenticated using (is_coordinator()) with check (is_coordinator());
create policy site_hero_clips_delete_coordinator on site_hero_clips
  for delete to authenticated using (is_coordinator());

-- Public bucket for the uploaded clips: anyone can read (the page plays them
-- straight from the public URL), only coordinators can upload or delete.
-- 50 MB cap per file — plenty for a WhatsApp-compressed clip.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "site_videos_public_read" on storage.objects
  for select using (bucket_id = 'site-videos');
create policy "site_videos_coordinator_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-videos' and is_coordinator());
create policy "site_videos_coordinator_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'site-videos' and is_coordinator());

-- The three clips the /rides loop shipped with, as static files. Desktop
-- focus puts the riders' heads inside the ~3:1 desktop band of each upright
-- clip; phones see most of the frame, so they stay centred.
insert into site_hero_clips (page, label, url, sort, start_s, end_s, focus_desktop, focus_mobile) values
  ('rides', 'קבוצה בשקיעה', '/rides-clips/group-sunset.mp4', 1, 0.3, 6.3, 44, 50),
  ('rides', 'מנופפים במדבר', '/rides-clips/desert-wave.mp4', 2, 7, 13, 38, 50),
  ('rides', 'רכיבה מול השמש', '/rides-clips/desert-sun.mp4', 3, 0.5, 6.5, 59, 50);
