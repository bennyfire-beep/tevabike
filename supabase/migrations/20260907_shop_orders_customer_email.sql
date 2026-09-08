-- shop_orders: שומרים את המייל של הלקוח על ההזמנה עצמה, לא רק כשהוא
-- מסמן קבלת מבצעים (community_contacts). בלי זה אין דרך לשלוח ללקוח את
-- אישור ההזמנה אחרי שבני מוודא תשלום בארבוקס ולוחץ "שלח לפאן רייד" —
-- הוא מקבל חשבונית מארבוקס אבל לא את פרטי ההזמנה/משלוח/זמן אספקה.
alter table shop_orders
  add column if not exists customer_email text;

comment on column shop_orders.customer_email is
  'מייל הלקוח כפי שהוזן בטופס /shop (לא חובה שם) — משמש לשליחת אישור הזמנה, בנפרד מ-marketing_optin.';
