-- קודי הפניה (שגרירים) לחנות הביגוד + מבצע כובע.
--
-- קוד הפניה: הלקוח מזין קוד (למשל YINON) או נכנס מקישור ?ref=YINON. אין
-- הנחה — הקוד רק נשמר עם ההזמנה כדי לדעת מי הביא אותה (עמלה לשגריר).
-- רק קוד פעיל מהטבלה מתקבל, כדי שטעויות הקלדה לא ייספרו.
create table if not exists tshirt_referral_codes (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{2,30}$'),
  owner_name text,
  commission_per_order numeric not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tshirt_referral_codes enable row level security;

create policy tshirt_referral_codes_select_authenticated
  on tshirt_referral_codes for select to authenticated using (true);
create policy tshirt_referral_codes_insert_authenticated
  on tshirt_referral_codes for insert to authenticated with check (true);
create policy tshirt_referral_codes_update_authenticated
  on tshirt_referral_codes for update to authenticated using (true) with check (true);
create policy tshirt_referral_codes_delete_authenticated
  on tshirt_referral_codes for delete to authenticated using (true);

insert into tshirt_referral_codes (code, owner_name) values ('YINON', 'ינון')
on conflict (code) do nothing;

alter table tshirt_orders
  add column if not exists referral_code text,
  -- מתי ההזמנה סומנה כשולמה — קובע את הסדר של "30 הראשונים ששילמו" במבצע הכובע
  add column if not exists paid_at timestamptz;

-- מבצע כובע: X ההזמנות הראשונות ששולמו, בסכום פריטים (בלי משלוח) מעל סף
alter table tshirt_shop_settings
  add column if not exists hat_promo_active boolean not null default true,
  add column if not exists hat_promo_min_total numeric not null default 400,
  add column if not exists hat_promo_limit integer not null default 30;
