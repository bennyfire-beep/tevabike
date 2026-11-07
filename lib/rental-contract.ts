import {
  PROTECTION_PRICE, PROTECTION_CAP, DEPOSIT_PER_BIKE, AGREED_VALUE_DEFAULT, RETURN_LOCATION,
  LATE_RETURN_HOURS, DISPUTE_DAYS, MIN_RIDER_AGE, CLEANING_FEE,
} from './rental'

// The rental agreement the customer signs on /rent. Both the page (to show it)
// and the API (to snapshot and hash it) render it from here, so what is stored
// as signed is exactly what was on screen.
//
// Bump CONTRACT_VERSION on ANY wording change: every booking records the
// version it was signed under, and old bookings keep their own snapshot.
//
// DRAFT — must be reviewed by a lawyer and the insurance agent before launch
// (docs/rental/PLAN.md §5 stage 1).

export const CONTRACT_VERSION = '2026-11-07-draft4'

export type ContractSection = { title: string; items: string[] }

const ils = (n: number) => `${n.toLocaleString('he-IL')} ₪`

export function contractSections(): ContractSection[] {
  return [
    {
      title: '1. הצדדים והאופניים',
      items: [
        'ההשכרה מבוצעת על ידי בני להט, המפעיל את העסק "טבע בייק" (להלן: "טבע בייק"). האופניים בבעלות טימואופן גרופ בע״מ ("טימו פאן") ומושכרים באמצעות טבע בייק.',
        'השוכר הוא האדם החותם על הסכם זה. השוכר אחראי לכל האופניים בהזמנה ולכל רוכב הרשום בה.',
        'האופניים, הסוללה, המטען, המנעול והמפתחות נמסרים לשוכר כשהם תקינים, כפי שתועד בצילום בעת המסירה.',
      ],
    },
    {
      title: '2. רכיבה ובטיחות',
      items: [
        `כל רוכב בן ${MIN_RIDER_AGE} לפחות, כשיר לרכיבת שטח ורוכב על אחריותו. השוכר מצהיר שכל רוכב קיבל הסבר על תפעול האופניים.`,
        'חובה לחבוש קסדה בכל הרכיבה. אסור לרכוב תחת השפעת אלכוהול או סמים, להרכיב נוסע, להשתתף בתחרות או לשנות את האופניים.',
        'האופניים ייעודיים לשבילים ולמסלולים. אסור לרכוב בכביש מהיר, במים עמוקים, בבוץ עמוק או בשטח סגור.',
        'אסור למסור את האופניים לאדם שאינו רשום בהזמנה.',
      ],
    },
    {
      title: '3. אחריות לנזק',
      items: [
        'השוכר אחראי לאופניים ולציוד מרגע המסירה ועד ההחזרה בפועל.',
        'כל נזק מאובחן ומתוקן בחנות טימו פאן בלבד. עלות הנזק נקבעת לפי אסמכתת החנות ולפי מחירון החלפים המצורף להזמנה.',
        `ללא מסלול הגנה: השוכר משלם את מלוא עלות הנזק.`,
        `עם מסלול הגנה (${ils(PROTECTION_PRICE)} לאופניים): נזק פיזי לאופניים מכוסה עד ${ils(PROTECTION_CAP)} במצטבר להשכרה. מעל הסכום הזה השוכר משלם רק את ההפרש. לדוגמה: נזק של 1,300 ₪ – השוכר משלם 300 ₪.`,
        'מסלול ההגנה אינו ביטוח. זו התחייבות מסחרית של טבע בייק. הוא לא מכסה: גניבה, אובדן, נזק מכוון, רכיבה בניגוד לסעיף 2, נזק לציוד שאינו האופניים, ונזק לגוף או לרכוש של אדם כלשהו.',
      ],
    },
    {
      title: '4. גניבה ואובדן',
      items: [
        'מסלול ההגנה לא מכסה גניבה ואובדן.',
        'השוכר מתחייב: לנעול את האופניים במנעול שנמסר לחפץ קבוע בכל פעם שהם לא בהשגחה ישירה; לא להשאיר מפתח במנעול או בסוללה; לא להשאיר את האופניים ללא השגחה בלילה.',
        'בגניבה השוכר מתחייב: להודיע לטבע בייק מיד, להגיש תלונה במשטרה תוך 24 שעות, ולמסור לטבע בייק את אישור התלונה, המנעול והמפתחות.',
        `בגניבה או באובדן של האופניים, מכל סיבה, השוכר משלם את מלוא המחיר של אופניים חדשים מאותו דגם, כפי שמופיע בהזמנה לכל אופניים (${ils(AGREED_VALUE_DEFAULT)} לאופניים, אלא אם נרשם בהזמנה סכום אחר).`,
        `אופניים שלא הוחזרו תוך ${LATE_RETURN_HOURS} שעות ממועד ההחזרה ייחשבו אבודים, וטבע בייק רשאית להגיש תלונה במשטרה.`,
        'אם האופניים יימצאו אחרי שהשוכר שילם, יוחזר לו הסכום ששולם, בניכוי עלות תיקון נזקים ודמי השכרה על התקופה שבה האופניים לא היו זמינים.',
      ],
    },
    {
      title: '5. החזרה, איחור וניקיון',
      items: [
        `האופניים נמסרים ומוחזרים ב${RETURN_LOCATION}, במועד שנקבע בהזמנה.`,
        'איחור של יותר משעה יחויב בדמי השכרה נוספים לפי המחירון: 4 שעות או יום מלא, הסכום הנמוך מבין השניים שמכסה את האיחור.',
        'יש להחזיר את האופניים נקיים במידה סבירה. אפשר לנקות אותם בעמדת הניקיון בקומה התחתונה של החנות, לפי הנחיות הצוות.',
        `אופניים שיוחזרו מלוכלכים מעבר ללכלוך סביר ולא נוקו יחויבו בדמי ניקיון של ${ils(CLEANING_FEE)} לאופניים, לאחר תיעוד מצבם בהחזרה. דמי הניקיון אינם חלק ממסלול ההגנה.`,
      ],
    },
    {
      title: DEPOSIT_PER_BIKE > 0 ? '6. פיקדון והרשאה לחיוב' : '6. תשלום חיובים נוספים',
      items: [
        ...(DEPOSIT_PER_BIKE > 0
          ? [
              `השוכר מאשר לטבע בייק לתפוס במסגרת כרטיס האשראי שלו פיקדון של עד ${ils(DEPOSIT_PER_BIKE)} לאופניים בעת המסירה. בהחזרה תקינה הפיקדון ישוחרר.`,
              'השוכר מאשר לטבע בייק לחייב את כרטיס האשראי ששימש לתשלום, או את הפיקדון, בסכומים שהוא חייב לפי סעיפים 3–5 (נזק, גניבה, איחור וניקיון), ועד הסכומים הקבועים בהם.',
            ]
          : [
              'השוכר מתחייב לשלם לטבע בייק כל סכום שהוא חייב לפי סעיפים 3–5 (נזק, גניבה ואובדן, איחור וניקיון), ועד הסכומים הקבועים בהם.',
            ]),
        `לפני כל חיוב כזה תשלח טבע בייק לשוכר בוואטסאפ או במייל את פירוט החיוב, תמונות ואסמכתה מהחנות, וקישור לתשלום. לשוכר יהיו ${DISPUTE_DAYS} ימי עסקים להשיג על החיוב; אם לא השיג, ישלם תוך 7 ימים ממועד ההודעה.`,
        'כל התשלומים נעשים דרך טבע בייק בלבד. פרטי כרטיס האשראי נשמרים אצל חברת הסליקה, ולא אצל טבע בייק.',
      ],
    },
    {
      title: '7. ביטול',
      items: [
        'ביטול עד 48 שעות לפני מועד ההשכרה – החזר מלא. ביטול מאוחר יותר – ללא החזר, למעט ביטול של טבע בייק בגלל מזג אוויר או בטיחות, שבו יינתן החזר מלא או מועד חלופי.',
      ],
    },
    {
      title: '8. פרטיות',
      items: [
        'פרטי השוכר והרוכבים נשמרים לצורך ההשכרה, הזיהוי, התשלום והבטיחות בלבד, ונגישים לצוות טבע בייק בלבד. טימו פאן מקבלת רק נתונים כספיים ללא פרטים אישיים.',
      ],
    },
  ]
}

// The four things the customer ticks separately, each tied to a section above.
export const CONSENTS = [
  { id: 'terms', label: `קראתי ואני מסכים/ה לתנאי ההשכרה, הבטיחות וההחזרה, כולל דמי ניקיון של ${ils(CLEANING_FEE)} לאופניים שיוחזרו מלוכלכים (סעיפים 1–2, 5, 7–8)` },
  { id: 'damage', label: `ידוע לי שמסלול ההגנה מכסה נזק פיזי עד ${ils(PROTECTION_CAP)} בלבד, אינו ביטוח, ומה לא נכלל בו (סעיף 3)` },
  { id: 'theft', label: `ידוע לי שמסלול ההגנה לא מכסה גניבה ואובדן, ושבגניבה או באובדן אשלם את מלוא המחיר של אופניים חדשים, כמפורט בהזמנה (סעיף 4)` },
  {
    id: 'card',
    label: DEPOSIT_PER_BIKE > 0
      ? `אני מאשר/ת תפיסת פיקדון של עד ${ils(DEPOSIT_PER_BIKE)} לאופניים וחיוב הכרטיס בסכומים לפי ההסכם, אחרי הודעה מראש (סעיף 6)`
      : 'אני מתחייב/ת לשלם חיובי נזק, גניבה, איחור וניקיון לפי ההסכם, אחרי הודעה מראש עם פירוט ואסמכתה (סעיף 6)',
  },
] as const

export type ConsentId = (typeof CONSENTS)[number]['id']

export type ContractBooking = {
  renter_name: string
  renter_id_number: string
  renter_phone: string
  rent_date: string
  slot_label: string
  items: { rider_name: string; bike_name: string; bike_value: number; protection: boolean; price: number }[]
  total: number
}

/** Plain-text snapshot of exactly what was signed — stored on the booking and hashed. */
export function contractText(b: ContractBooking): string {
  const lines: string[] = []
  lines.push(`הסכם השכרת אופניים – טבע בייק · גרסה ${CONTRACT_VERSION}`)
  lines.push('')
  lines.push(`שוכר: ${b.renter_name} · ת״ז ${b.renter_id_number} · טלפון ${b.renter_phone}`)
  lines.push(`מועד: ${b.rent_date} · ${b.slot_label}`)
  for (const it of b.items) {
    lines.push(`- ${it.rider_name}: ${it.bike_name}${it.protection ? ' + מסלול הגנה' : ''} · ${it.price} ₪ · מחיר אופניים חדשים (גניבה/אובדן): ${ils(it.bike_value)}`)
  }
  lines.push(`סה״כ: ${b.total} ₪`)
  lines.push('')
  for (const s of contractSections()) {
    lines.push(s.title)
    s.items.forEach((t, i) => lines.push(`${i + 1}. ${t}`))
    lines.push('')
  }
  lines.push('אישורים:')
  for (const c of CONSENTS) lines.push(`[V] ${c.label}`)
  return lines.join('\n')
}
