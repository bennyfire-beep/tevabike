// Shared config for the "סובב מצפה רמון" election-day ride (27.10.2026) —
// used by the page (app/sovev-ramon) and its API (app/api/sovev-ramon) so the
// seat count, prices and payment links can never drift between them.

// Seats in Benny's car for riders (8 riders + Benny = 9). Arriving on your own is not capped.
export const RIDE_SEATS = 8

export const TRANSPORT = {
  ride: { label: 'מגיעים איתי ברכב', sub: '🚗 הסעה עם טבע בייק', price: 180, payUrl: 'https://arbox.link/bgpFmBiE' },
  self: { label: 'מגיעים עצמאית', sub: '🚙 ברכב שלכם', price: 150, payUrl: 'https://arbox.link/yEo2CTwd' },
} as const

export type Transport = keyof typeof TRANSPORT
