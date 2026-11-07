-- E-bike rental (טבע בייק × טימו פאן) — docs/rental/PLAN.md.
--
-- rental_bikes          the fleet: photos, frame size, rider height range
-- rental_bookings       one per customer order, incl. the signed contract
-- rental_booking_items  one per bike in the order (rider, height, protection)
--
-- The public page never touches these tables directly: app/api/rent uses the
-- service-role key, and creates a booking only through rental_book(), which
-- locks each bike+date so two customers can never get the same bike for
-- clashing slots. The policies below are for app/admin/coordinator/rentals,
-- gated by is_coordinator() like every other coordinator-only table.

create table if not exists rental_bikes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,                       -- shown to customers, e.g. "Whistle B-Rush #3"
  model text,
  size text not null check (size in ('S', 'M', 'L', 'XL')),
  height_min int check (height_min between 120 and 220),   -- null → default range for the size (lib/rental.ts)
  height_max int check (height_max between 120 and 220),
  description text,
  photos text[] not null default '{}',
  frame_number text,                        -- staff only, never sent to the public page
  agreed_value int,                         -- staff only; null → AGREED_VALUE_DEFAULT
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists rental_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rent_date date not null,
  slot text not null check (slot in ('morning', 'afternoon', 'full')),
  renter_name text not null,
  renter_id_number text not null,
  renter_phone text not null,
  renter_email text,
  total int not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'picked_up', 'returned', 'cancelled')),
  notes text,

  -- Signed contract (simple electronic signature): what was shown, that it
  -- was not changed afterwards, and who agreed to it and when.
  contract_version text not null,
  contract_text text not null,
  contract_sha256 text not null,
  consents jsonb not null,
  signed_name text not null,
  signed_at timestamptz not null default now(),
  signer_ip text,
  signer_user_agent text,
  signature_path text,                      -- PNG in the private rental-contracts bucket

  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  whatsapp_optin_source text
);

create table if not exists rental_booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references rental_bookings(id) on delete cascade,
  bike_id uuid not null references rental_bikes(id),
  rent_date date not null,                  -- copied from the booking for the availability lookup
  slot text not null check (slot in ('morning', 'afternoon', 'full')),
  rider_name text not null,
  rider_height_cm int not null check (rider_height_cm between 120 and 220),
  protection boolean not null default false,
  price int not null
);

create index if not exists rental_booking_items_bike_date on rental_booking_items (bike_id, rent_date);
create index if not exists rental_bookings_date on rental_bookings (rent_date);

-- ── Atomic booking ──
-- Takes the booking row and its items as JSON, locks every bike+date, refuses
-- if any bike is already taken for a clashing slot (same slot, or either is a
-- full day), then inserts everything in one transaction.
create or replace function rental_book(p_booking jsonb, p_items jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_date date := (p_booking->>'rent_date')::date;
  v_slot text := p_booking->>'slot';
begin
  for v_item in select * from jsonb_array_elements(p_items) order by value->>'bike_id' loop
    perform pg_advisory_xact_lock(hashtext('rental:' || (v_item->>'bike_id') || ':' || v_date::text));

    if not exists (select 1 from rental_bikes where id = (v_item->>'bike_id')::uuid and active) then
      raise exception 'bike_unavailable:%', v_item->>'bike_id';
    end if;

    if exists (
      select 1
      from rental_booking_items i
      join rental_bookings b on b.id = i.booking_id
      where i.bike_id = (v_item->>'bike_id')::uuid
        and i.rent_date = v_date
        and b.status <> 'cancelled'
        and (i.slot = 'full' or v_slot = 'full' or i.slot = v_slot)
    ) then
      raise exception 'bike_taken:%', v_item->>'bike_id';
    end if;
  end loop;

  insert into rental_bookings (
    rent_date, slot, renter_name, renter_id_number, renter_phone, renter_email, total,
    contract_version, contract_text, contract_sha256, consents, signed_name,
    signer_ip, signer_user_agent, whatsapp_optin, whatsapp_optin_at, whatsapp_optin_source
  ) values (
    v_date, v_slot, p_booking->>'renter_name', p_booking->>'renter_id_number',
    p_booking->>'renter_phone', nullif(p_booking->>'renter_email', ''), (p_booking->>'total')::int,
    p_booking->>'contract_version', p_booking->>'contract_text', p_booking->>'contract_sha256',
    p_booking->'consents', p_booking->>'signed_name',
    p_booking->>'signer_ip', p_booking->>'signer_user_agent',
    coalesce((p_booking->>'whatsapp_optin')::boolean, false),
    (p_booking->>'whatsapp_optin_at')::timestamptz, p_booking->>'whatsapp_optin_source'
  ) returning id into v_id;

  insert into rental_booking_items (booking_id, bike_id, rent_date, slot, rider_name, rider_height_cm, protection, price)
  select v_id, (x->>'bike_id')::uuid, v_date, v_slot, x->>'rider_name',
         (x->>'rider_height_cm')::int, coalesce((x->>'protection')::boolean, false), (x->>'price')::int
  from jsonb_array_elements(p_items) x;

  return v_id;
end;
$$;

-- Only the server (service role) books.
revoke all on function rental_book(jsonb, jsonb) from public, anon, authenticated;

-- ── RLS: coordinators only ──
alter table rental_bikes enable row level security;
alter table rental_bookings enable row level security;
alter table rental_booking_items enable row level security;

create policy rental_bikes_coordinator_all on rental_bikes
  for all to authenticated using (is_coordinator()) with check (is_coordinator());

create policy rental_bookings_coordinator_select on rental_bookings
  for select to authenticated using (is_coordinator());
-- Status and notes only; the contract columns are never edited from the app
-- (the update policy can't restrict columns, so the screen simply doesn't
-- send them — the stored sha256 shows if contract_text was ever changed).
create policy rental_bookings_coordinator_update on rental_bookings
  for update to authenticated using (is_coordinator()) with check (is_coordinator());

create policy rental_booking_items_coordinator_select on rental_booking_items
  for select to authenticated using (is_coordinator());

-- ── Storage ──
-- Bike photos: public read so /rent can show them; coordinators upload.
insert into storage.buckets (id, name, public)
values ('rental-bike-photos', 'rental-bike-photos', true)
on conflict (id) do nothing;

create policy "rental_bike_photos_public_read" on storage.objects
  for select using (bucket_id = 'rental-bike-photos');
create policy "rental_bike_photos_coordinator_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'rental-bike-photos' and is_coordinator());
create policy "rental_bike_photos_coordinator_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'rental-bike-photos' and is_coordinator());

-- Signatures: private. Written by the server, read by coordinators only.
insert into storage.buckets (id, name, public)
values ('rental-contracts', 'rental-contracts', false)
on conflict (id) do nothing;

create policy "rental_contracts_coordinator_read" on storage.objects
  for select to authenticated using (bucket_id = 'rental-contracts' and is_coordinator());
