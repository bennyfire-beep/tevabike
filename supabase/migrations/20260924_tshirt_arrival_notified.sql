-- מתי נשלח ללקוח מייל "החולצות הגיעו" (כפתור בעמוד הניהול tshirt-orders).
-- null = עוד לא נשלח. מונע שליחה כפולה אם לוחצים שוב על הכפתור.
alter table tshirt_orders add column if not exists arrival_notified_at timestamptz;
