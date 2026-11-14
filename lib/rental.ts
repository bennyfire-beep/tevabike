// Shared config for e-bike rental (טבע בייק × טימו פאן) — used by the public
// page (app/rent), its API (app/api/rent) and the coordinator screen
// (app/admin/coordinator/rentals), so prices, slots and policy amounts can
// never drift between what the customer sees, signs and is charged.
//
// Plan and open decisions: docs/rental/PLAN.md.

// ── Open / closed ──
// true → anyone can book on /rent (opened Nov 2026). false → /rent shows the
// bikes and a "coming soon" note; the booking form only appears with
// ?preview=1 (for testing).
export const RENTAL_OPEN = true

// ── Prices (₪, incl. VAT) ──
// The 4-hour rental includes a cup of coffee at the Timo Pan shop (Nov 2026).
export const PRICE = { half: 270, full: 390 } as const
export const HALF_DAY_PERK = 'כולל כוס קפה בחנות טימו פאן'
export const PROTECTION_PRICE = 90
export const PROTECTION_CAP = 1000

// ── Slots ──
// A half-day rental is 4 hours; two can share a bike on the same day. A full
// day blocks the bike for the whole day. Hours are placeholders until the
// partners fix opening hours (PLAN.md §6.7).
export type SlotId = 'morning' | 'afternoon' | 'full'
export const SLOTS: { id: SlotId; label: string; hours: string; duration: 'half' | 'full' }[] = [
  { id: 'morning', label: 'בוקר · 4 שעות', hours: '08:00–12:00', duration: 'half' },
  { id: 'afternoon', label: 'צהריים · 4 שעות', hours: '13:00–17:00', duration: 'half' },
  { id: 'full', label: 'יום מלא', hours: '08:00–17:00', duration: 'full' },
]
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map((s) => [s.id, s])) as Record<SlotId, (typeof SLOTS)[number]>
export const isSlot = (v: unknown): v is SlotId => typeof v === 'string' && v in SLOT_BY_ID

/** Two bookings of the same bike on the same date clash unless one is morning and the other afternoon. */
export const slotsClash = (a: SlotId, b: SlotId) => a === 'full' || b === 'full' || a === b

export const slotPrice = (slot: SlotId) => PRICE[SLOT_BY_ID[slot].duration]

// ── Payment links ──
// Today: fixed Arbox links (one product per line; the customer sets the
// quantity on the Arbox page). Soon: Rivhit links created per booking with the
// exact total — when that lands, only paymentLinks() changes.
// null → the confirmation screen says a payment link will be sent on WhatsApp.
export const PAY_LINKS: { half: string | null; full: string | null; protection: string | null } = {
  half: 'https://arbox.link/7wLVYG7G', // "השכרת אופניים 4 שעות" · 270 ₪
  full: 'https://arbox.link/afej9_OH', // "השכרת אופניים חשמליות" · 390 ₪
  protection: 'https://arbox.link/O0nb5pPX', // 90 ₪
}

export type PayLine = { label: string; qty: number; unit: number; url: string | null }

export function paymentLines(items: { slot: SlotId; protection: boolean }[]): PayLine[] {
  const lines: PayLine[] = []
  const halves = items.filter((i) => SLOT_BY_ID[i.slot].duration === 'half').length
  const fulls = items.filter((i) => SLOT_BY_ID[i.slot].duration === 'full').length
  const prot = items.filter((i) => i.protection).length
  if (halves) lines.push({ label: 'השכרה 4 שעות', qty: halves, unit: PRICE.half, url: PAY_LINKS.half })
  if (fulls) lines.push({ label: 'השכרה יום מלא', qty: fulls, unit: PRICE.full, url: PAY_LINKS.full })
  if (prot) lines.push({ label: 'מסלול הגנה', qty: prot, unit: PROTECTION_PRICE, url: PAY_LINKS.protection })
  return lines
}

export const bookingTotal = (items: { slot: SlotId; protection: boolean }[]) =>
  items.reduce((sum, i) => sum + slotPrice(i.slot) + (i.protection ? PROTECTION_PRICE : 0), 0)

// ── Sizes ──
// Default height range per frame size. A bike can override its own range in
// the admin screen (rental_bikes.height_min / height_max), since geometry
// differs between models.
export type BikeSize = 'S' | 'M' | 'L' | 'XL'
export const SIZES: { id: BikeSize; label: string; min: number; max: number }[] = [
  { id: 'S', label: 'Small', min: 150, max: 165 },
  { id: 'M', label: 'Medium', min: 165, max: 178 },
  { id: 'L', label: 'Large', min: 178, max: 190 },
  { id: 'XL', label: 'X-Large', min: 190, max: 205 },
]
export const SIZE_LABEL = Object.fromEntries(SIZES.map((s) => [s.id, s.label])) as Record<BikeSize, string>
export const isSize = (v: unknown): v is BikeSize => typeof v === 'string' && SIZES.some((s) => s.id === v)

/** The recommended size for a rider height; on a boundary the smaller size wins. */
export function recommendSize(heightCm: number): BikeSize | null {
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 220) return null
  const hit = SIZES.find((s) => heightCm >= s.min && heightCm < s.max)
  if (hit) return hit.id
  return heightCm < SIZES[0].min ? SIZES[0].id : SIZES[SIZES.length - 1].id
}

export type Bike = {
  id: string
  name: string
  model: string | null
  size: BikeSize
  height_min: number | null
  height_max: number | null
  description: string | null
  photos: string[]
  active: boolean
  sort_order: number
}

/** Does this bike fit a rider? Uses the bike's own range when set, else the size's default range. */
export function bikeFits(bike: Pick<Bike, 'size' | 'height_min' | 'height_max'>, heightCm: number) {
  const def = SIZES.find((s) => s.id === bike.size)!
  const min = bike.height_min ?? def.min
  const max = bike.height_max ?? def.max
  return heightCm >= min && heightCm <= max
}

// ── Policy amounts (placeholders — PLAN.md §6, to be decided with Timo) ──
// Card hold at pickup. 0 = no deposit (decided Nov 2026: none until the
// Rivhit gateway can hold a card); the contract drops the deposit clause.
export const DEPOSIT_PER_BIKE = 0
// Theft or loss: the renter pays the price of a NEW bike of the same model
// (decided Nov 2026). This is the default when a bike has no agreed_value set
// in the admin screen. Set to 25,000 by Benny (Nov 2026).
export const AGREED_VALUE_DEFAULT = 25000
export const LATE_RETURN_HOURS = 24 // after this a bike not returned counts as lost
export const DISPUTE_DAYS = 3 // business days the customer has to dispute a damage charge

// Agreed (business plan, Nov 2026): a bike returned dirty beyond reasonable
// trail dirt and not washed is charged this, per bike, after the return
// condition is documented. Not covered by the protection plan.
export const CLEANING_FEE = 40

// Where bikes are picked up and returned. The wash station is downstairs in
// the shop at the same site.
export const RETURN_LOCATION = 'מתחם השכרת האופניים של טבע בייק ברקפת'

// ── ID photo ──
// Required to book. Deleted automatically this many days after the rental
// date once the booking is closed (app/api/cron/rental-id-cleanup).
export const ID_PHOTO_RETENTION_DAYS = 90
// Longest side after the browser shrinks the photo; enough to read an ID card.
export const ID_PHOTO_MAX_PX = 1600

// ── Rider rules ──
export const MIN_RENTER_AGE = 18
export const MIN_RIDER_AGE = 16 // placeholder — check the Ralbad rules for the exact model
export const MAX_BIKES_PER_BOOKING = 10

export const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין לתשלום',
  paid: 'שולם',
  picked_up: 'נמסר',
  returned: 'הוחזר',
  cancelled: 'בוטל',
}
