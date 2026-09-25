-- משלוח עד הבית לחולצות (בנוסף לאיסוף עצמי חינם מהמועדון).
-- דמי המשלוח נגבים פעם אחת להזמנה, דרך קישור Arbox משלוח אחד — בנוסף
-- לקישורי התשלום הרגילים של המוצרים.
alter table tshirt_shop_settings
  add column if not exists shipping_price numeric not null default 25,
  add column if not exists shipping_arbox_link text;

alter table tshirt_orders
  add column if not exists fulfillment text not null default 'pickup'
    check (fulfillment in ('pickup', 'delivery')),
  add column if not exists delivery_address text,
  add column if not exists shipping_fee numeric not null default 0;
