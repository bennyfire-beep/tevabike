// Pre-ride checklist for rental bikes. The renter gets a link in the booking
// email (app/rent/checklist?b=<booking id>) and checks every bike at pickup.
// Any "no" → don't ride; the bike is fixed at the Timo Pan shop first, at the
// shop's expense, then the renter checks it again.

export const CHECKLIST: { id: string; label: string }[] = [
  { id: 'brakes', label: 'הבלם הקדמי והבלם האחורי עוצרים היטב' },
  { id: 'motor', label: 'המנוע והצג נדלקים, והעזרה החשמלית עובדת בכל הרמות' },
  { id: 'battery', label: 'הסוללה טעונה ונעולה במקומה' },
  { id: 'wheels', label: 'הגלגלים מסתובבים חלק, בלי תזוזה לצדדים, והצמיגים מנופחים' },
  { id: 'gears', label: 'ההילוכים מתחלפים חלק והשרשרת לא קופצת' },
  { id: 'suspension', label: 'הבולמים עובדים, בלי דליפת שמן' },
  { id: 'cockpit', label: 'הכידון, המושב והדוושות מהודקים, והמושב בגובה שמתאים לי' },
  { id: 'lock', label: 'קיבלתי מנעול ומפתחות' },
  { id: 'damage', label: 'אין נזק נראה לעין: סדקים, שריטות עמוקות או חלקים שבורים' },
]

export const CHECKLIST_IDS = CHECKLIST.map((c) => c.id)
export const CHECKLIST_LABEL = Object.fromEntries(CHECKLIST.map((c) => [c.id, c.label])) as Record<string, string>

export const checklistUrl = (bookingId: string) => `https://www.tevabike.com/rent/checklist?b=${bookingId}`
