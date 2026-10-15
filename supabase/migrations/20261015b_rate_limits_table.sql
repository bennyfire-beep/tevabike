-- The login / OTP brute-force throttle (lib/auth-actions.ts: checkRateLimit,
-- resetRateLimit) reads and writes `rate_limits`, which is declared in
-- supabase/schema.sql but was never created in the live project. Every login
-- produced 404s on /rest/v1/rate_limits and, because a missing row reads as
-- "window expired, allow", the throttle silently did nothing.
--
-- Same definition as schema.sql. RLS on with no policies: only the service
-- role (used server-side by auth-actions) can touch it.
create table if not exists rate_limits (
  id           uuid primary key default gen_random_uuid(),
  identifier   text not null,                      -- phone or email
  action       text not null check (action in ('otp', 'login')),
  attempts     int  not null default 1,
  window_start timestamptz not null default now(),
  locked_until timestamptz,
  unique(identifier, action)
);

alter table rate_limits enable row level security;
