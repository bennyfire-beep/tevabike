-- Benny asked to remove all the /rides background clips. Drops the three
-- seeded rows from 20261004_site_hero_clips.sql (their static files are
-- deleted from public/rides-clips in the same change). With no active clip
-- the page plays its built-in default — the montage at
-- public/rides-clips/montage.mp4 — until new clips are uploaded in the admin.
delete from site_hero_clips
where page = 'rides'
  and storage_path is null
  and url in ('/rides-clips/group-sunset.mp4', '/rides-clips/desert-wave.mp4', '/rides-clips/desert-sun.mp4');
