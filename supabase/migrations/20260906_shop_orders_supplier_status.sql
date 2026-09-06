-- shop_orders: מעקב אחרי הסטטוס בפועל מול פאן רייד, אחרי ששלחנו את
-- ההזמנה אליהם (supplier_notified). אין webhook/מייל אוטומטי שקורא את
-- התשובות של פאן רייד (הן מגיעות לתיבה האישית של בני) — הרכז/בני קורא
-- אותן בעצמו ומעדכן כאן. תזכורת שבועית (app/api/cron/shop-supplier-followup)
-- מזכירה אילו הזמנות עדיין ממתינות לעדכון.

alter table shop_orders
  add column if not exists supplier_status text,
  add column if not exists final_price numeric,
  add column if not exists customer_updated_at timestamptz;

comment on column shop_orders.supplier_status is
  'עדכון ידני אחרי שקוראים את המייל החוזר מפאן רייד: ordered/shipped/delayed/cancelled. null = טרם נבדק.';
comment on column shop_orders.final_price is
  'מחיר סופי כפי שאושר ע"י פאן רייד, אם שונה מ-total_amount המחושב. null = אין שינוי.';
comment on column shop_orders.customer_updated_at is
  'מתי נשלחה ללקוח הודעת עדכון (מהמסך, ידנית בוואטסאפ) — לצורך מעקב בלבד, לא אישור מסירה.';
