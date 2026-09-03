-- =====================================================================
-- TrickTrack — Supabase Migration
-- Tables, constraints, indexes, RLS policies, and leaderboard view
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type skill_level as enum ('beginner', 'intermediate', 'advanced', 'pro');
create type trick_type as enum ('pop', 'bunny_hop', 'barspin', 'tabletop', 'unclassified');
create type session_status as enum ('uploading', 'processing', 'completed', 'failed');

-- ---------------------------------------------------------------------
-- profiles
-- One row per authenticated user (mirrors auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
    id                  uuid primary key references auth.users(id) on delete cascade,
    full_name           text not null,
    email               text not null unique,
    phone               text,
    age                 smallint check (age is null or (age >= 5 and age <= 100)),
    wheel_size_inches   numeric(4,1) not null check (wheel_size_inches in (16.0, 18.0, 20.0, 24.0, 26.0, 27.5, 29.0)),
    skill_level         skill_level not null default 'beginner',
    avatar_url          text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.profiles is 'Rider profile, one-to-one with auth.users';

-- ---------------------------------------------------------------------
-- sessions
-- A single raw recording (10-30 min) uploaded by a rider
-- ---------------------------------------------------------------------
create table public.sessions (
    id              uuid primary key default uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id) on delete cascade,
    raw_video_url   text not null,
    duration_sec    numeric(8,2),
    status          session_status not null default 'uploading',
    error_message   text,
    created_at      timestamptz not null default now(),
    processed_at    timestamptz
);

create index idx_sessions_user_id on public.sessions(user_id);
create index idx_sessions_status on public.sessions(status);

-- ---------------------------------------------------------------------
-- jump_attempts
-- One row per detected jump within a session
-- ---------------------------------------------------------------------
create table public.jump_attempts (
    id                  uuid primary key default uuid_generate_v4(),
    session_id          uuid not null references public.sessions(id) on delete cascade,
    user_id             uuid not null references public.profiles(id) on delete cascade,
    clip_url            text not null,
    annotated_video_url text,
    height_cm           numeric(6,2) check (height_cm is null or height_cm >= 0),
    distance_cm         numeric(6,2) check (distance_cm is null or distance_cm >= 0),
    airtime_sec         numeric(5,3) check (airtime_sec is null or airtime_sec >= 0),
    speed_kmh           numeric(5,2) check (speed_kmh is null or speed_kmh >= 0),
    trick_type          trick_type not null default 'unclassified',
    confidence          numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
    points              integer not null default 0,
    sequence_index      integer not null default 0,
    created_at          timestamptz not null default now()
);

create index idx_jump_attempts_session_id on public.jump_attempts(session_id);
create index idx_jump_attempts_user_id on public.jump_attempts(user_id);
create index idx_jump_attempts_created_at on public.jump_attempts(created_at desc);
create index idx_jump_attempts_height on public.jump_attempts(height_cm desc);

-- ---------------------------------------------------------------------
-- updated_at trigger for profiles
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Points calculation trigger (simple scoring: height + distance + trick bonus)
-- Adjust weights to taste; kept server-side so clients can't spoof scores.
-- ---------------------------------------------------------------------
create or replace function public.calculate_jump_points()
returns trigger
language plpgsql
as $$
declare
    trick_bonus integer;
begin
    trick_bonus := case new.trick_type
        when 'bunny_hop' then 50
        when 'barspin'   then 150
        when 'tabletop'  then 120
        when 'pop'       then 20
        else 0
    end;

    new.points := round(
        coalesce(new.height_cm, 0) * 2
        + coalesce(new.distance_cm, 0) * 1.5
        + trick_bonus
    );
    return new;
end;
$$;

create trigger trg_jump_attempts_points
    before insert or update of height_cm, distance_cm, trick_type
    on public.jump_attempts
    for each row
    execute function public.calculate_jump_points();

-- ---------------------------------------------------------------------
-- leaderboard view — weekly rankings by height and trick variety
-- ---------------------------------------------------------------------
create or replace view public.leaderboard as
select
    p.id                                   as user_id,
    p.full_name,
    p.avatar_url,
    date_trunc('week', ja.created_at)      as week_start,
    count(*)                               as jumps_count,
    count(distinct ja.trick_type)
        filter (where ja.trick_type <> 'unclassified')  as trick_variety,
    max(ja.height_cm)                      as best_height_cm,
    max(ja.distance_cm)                    as best_distance_cm,
    sum(ja.points)                         as total_points
from public.jump_attempts ja
join public.profiles p on p.id = ja.user_id
group by p.id, p.full_name, p.avatar_url, date_trunc('week', ja.created_at)
order by week_start desc, total_points desc;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.sessions      enable row level security;
alter table public.jump_attempts enable row level security;

-- profiles: users manage their own row; everyone can read basic public fields
-- (leaderboard needs to read full_name/avatar_url for all users)
create policy "profiles_select_all"
    on public.profiles for select
    using (true);

create policy "profiles_insert_own"
    on public.profiles for insert
    with check (auth.uid() = id);

create policy "profiles_update_own"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- sessions: strictly private to the owning rider
create policy "sessions_select_own"
    on public.sessions for select
    using (auth.uid() = user_id);

create policy "sessions_insert_own"
    on public.sessions for insert
    with check (auth.uid() = user_id);

create policy "sessions_update_own"
    on public.sessions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "sessions_delete_own"
    on public.sessions for delete
    using (auth.uid() = user_id);

-- jump_attempts: owner has full control; everyone can read (for the
-- community feed / leaderboard). Tighten "select_all" to "select_own"
-- if the feed should not be public.
create policy "jump_attempts_select_all"
    on public.jump_attempts for select
    using (true);

create policy "jump_attempts_insert_own"
    on public.jump_attempts for insert
    with check (auth.uid() = user_id);

create policy "jump_attempts_update_own"
    on public.jump_attempts for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "jump_attempts_delete_own"
    on public.jump_attempts for delete
    using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Service-role bypass note:
-- The CV processing microservice should call Supabase using the
-- service_role key (server-side only, never shipped to the client).
-- That key bypasses RLS entirely, so the pipeline can insert/update
-- jump_attempts and sessions for any user_id after processing a video.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Storage buckets (run once; safe to re-run)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('raw-sessions', 'raw-sessions', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('jump-clips', 'jump-clips', true)
on conflict (id) do nothing;

-- Storage RLS: users can only upload to a folder path prefixed with their own uid
create policy "raw_sessions_owner_rw"
    on storage.objects for all
    using (bucket_id = 'raw-sessions' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'raw-sessions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "jump_clips_public_read"
    on storage.objects for select
    using (bucket_id = 'jump-clips');

create policy "jump_clips_owner_write"
    on storage.objects for insert
    with check (bucket_id = 'jump-clips' and (storage.foldername(name))[1] = auth.uid()::text);
