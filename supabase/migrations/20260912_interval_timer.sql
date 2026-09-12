-- טיימר אינטרוול מסונכרן (Push) — טבלאות ל"מקלט" הציבורי (חניכים, ללא
-- login) ולמצב החי של הטיימר שהמדריך שולט בו. משתמש בתשתית ה-Push/VAPID
-- הקיימת (ראו lib/whatsapp-notify.ts ו-push_subscriptions) בלי לגעת בה —
-- זה ערוץ נפרד לגמרי, לחניכים ולא לצוות.

-- ── חניכים רשומים לאותות ────────────────────────────────────────────────────
-- נרשמים דרך /interval/join בלי חשבון. אין policy ציבורית בכוונה — כל קריאה
-- וכתיבה עוברות דרך /api/interval/* עם ה-service role (ראו lib/interval-
-- server.ts), אותו דפוס בדיוק כמו push_subscriptions למעלה בקובץ הקודם: ה-RLS
-- כאן הוא רשת ביטחון, לא האכיפה עצמה.
create table if not exists interval_subscribers (
  id                uuid primary key default gen_random_uuid(),
  first_name        text not null,
  last_name         text not null,
  phone             text,
  push_subscription jsonb,
  created_at        timestamptz not null default now()
);

alter table interval_subscribers enable row level security;

drop policy if exists "interval_subscribers_service_all" on interval_subscribers;
create policy "interval_subscribers_service_all" on interval_subscribers
  for all to service_role using (true) with check (true);

-- ── מצב חי של הטיימר ─────────────────────────────────────────────────────────
-- שורה יחידה (singleton) — הפיצ'ר מניח שעה נתונה יש טיימר אינטרוול חי אחד
-- (סניף/קבוצה אחת שמריצה מהפאנל). כל פעולת שליטה מעדכנת את אותה שורה במקום,
-- כך שה-Realtime subscription של המקלט תמיד צופה במזהה אחד קבוע.
create table if not exists interval_sessions (
  id                uuid primary key default gen_random_uuid(),
  status            text not null default 'idle' check (status in ('idle', 'running', 'paused', 'finished')),
  work_seconds      int not null default 30 check (work_seconds > 0),
  rest_seconds      int not null default 30 check (rest_seconds >= 0),
  rounds            int not null default 1 check (rounds > 0),
  current_round     int not null default 0,
  current_phase     text not null default 'idle' check (current_phase in ('idle', 'work', 'rest', 'done')),
  phase_ends_at     timestamptz,
  -- זמן שנותר בשלב, בשניות — נשמר רק בזמן השהיה (status='paused'), כדי
  -- שחידוש יחשב phase_ends_at חדש בלי לאבד את הזמן שכבר עבר.
  remaining_seconds int,
  updated_at        timestamptz not null default now()
);

insert into interval_sessions (id, status, current_phase)
values ('00000000-0000-0000-0000-000000000001', 'idle', 'idle')
on conflict (id) do nothing;

alter table interval_sessions enable row level security;

-- קריאה ציבורית — מסך ה"מקלט" (בלי login) נרשם ישירות עם ה-anon key
-- ל-Supabase Realtime על הטבלה הזו. אין כאן שום מידע רגיש (לא כמו
-- interval_subscribers), אז חשיפה לקריאה בלבד היא בטוחה.
drop policy if exists "interval_sessions_select" on interval_sessions;
create policy "interval_sessions_select" on interval_sessions
  for select to anon, authenticated using (true);

drop policy if exists "interval_sessions_service_write" on interval_sessions;
create policy "interval_sessions_service_write" on interval_sessions
  for all to service_role using (true) with check (true);

-- Realtime — postgres_changes דורש שהטבלה תהיה בפרסום. אידמפוטנטי: לא נכשל
-- אם היא כבר שם (למשל אחרי rerun של המיגרציה).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'interval_sessions'
  ) then
    alter publication supabase_realtime add table interval_sessions;
  end if;
end $$;
