// מוצרי חולצות שהוסרו מהחנות. לא נמחקים מטבלת tshirt_products כי
// tshirt_orders מפנה אליהם (product_slug references tshirt_products) — רק
// מוסתרים בעמוד /shop ונחסמים להזמנה ב-/api/tshirt-order.
export const HIDDEN_TSHIRT_SLUGS = ["long_named"];
