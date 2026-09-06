-- shop_orders: שדות נוספים לקליטה האוטומטית של תשובות פאן רייד (ראה
-- app/api/webhooks/resend-inbound). tracking_number ו-supplier_reply_raw
-- מתמלאים אוטומטית מהפענוח; supplier_status/final_price כבר קיימים
-- מ-20260906_shop_orders_supplier_status.sql ומשמשים גם כאן כהצעה
-- אוטומטית שבני עדיין מאשר/מתקן במסך "הזמנות חנות".

alter table shop_orders
  add column if not exists tracking_number text,
  add column if not exists supplier_reply_raw text;

comment on column shop_orders.tracking_number is
  'מספר חבילה/מעקב כפי שחולץ אוטומטית מתשובת פאן רייד. null = לא זוהה.';
comment on column shop_orders.supplier_reply_raw is
  'קטע הטקסט הגולמי מתשובת פאן רייד (לפני הציטוט של ההזמנה המקורית), לבדיקה ידנית אם הזיהוי האוטומטי לא ברור.';
