-- ביטול הזמנת ביגוד מפאנל הניהול (במקום מחיקה): ההזמנה נשארת ברשימה
-- מסומנת "בוטלה" ויוצאת מסיכום המידות ומהודעת "החולצות הגיעו".
alter table tshirt_orders add column if not exists cancelled_at timestamptz;
