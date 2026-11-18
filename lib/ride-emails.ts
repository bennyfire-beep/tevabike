import { Resend } from 'resend'
import { buildICS } from '@/lib/ics'
import {
  RENTAL_PRICE, RENTAL_PAY_URL, TRIPS_PER_MONTH, monthOf, monthLabel, type RideSession, type RiderType,
} from '@/lib/ride-sessions'

// ============================================================
// מיילים לנרשמים לטיולי רכיבה:
//   confirmation — מיד אחרי ההרשמה (app/api/rides/route.ts)
//   reminder     — יומיים לפני הטיול (app/api/cron/ride-reminders)
// שניהם מצרפים את הטיול ליומן (.ics). שליחה דרך Resend, fire-and-forget:
// מייל שנכשל לעולם לא מפיל הרשמה.
// ============================================================

const FROM = 'טבע בייק <info@mail.tevabike.com>'
const REPLY_TO = 'bennyfire@gmail.com'
const PINK = '#D4288A'
const SITE = 'https://tevabike.com'

const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** '8:00–12:00' → ['08:00', '12:00'] (null if the hours string isn't a range). */
export function hoursRange(hours: string): [string, string] | null {
  const m = hours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/)
  if (!m) return null
  return [`${m[1].padStart(2, '0')}:${m[2]}`, `${m[3].padStart(2, '0')}:${m[4]}`]
}

function tripIcs(s: RideSession): string | null {
  const range = hoursRange(s.hours)
  if (!range) return null
  return buildICS({
    title: `טיול רכיבה — ${s.title}`,
    date: s.date,
    startTime: range[0],
    endTime: range[1],
    location: s.meetingPoint,
    description: `מדריך: ${s.guide}. ${SITE}/rides/${s.slug}`,
    timezone: 'Asia/Jerusalem',
  })
}

function button(href: string, label: string, outline = false) {
  const style = outline
    ? `display:inline-block;border:2px solid ${PINK};color:${PINK};padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:700`
    : `display:inline-block;background:${PINK};color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700`
  return `<p style="margin:14px 0"><a href="${href}" style="${style}">${esc(label)}</a></p>`
}

function detailsTable(s: RideSession) {
  const rows: [string, string][] = [
    ['מתי', `${s.dateLabel} · ${s.hours}`],
    ['נקודת מפגש', s.meetingPoint],
    ['מדריך', s.guide],
    ['מסלול', `${s.distanceKm} ק״מ · ${s.climbM} מ׳ טיפוס · רמה טכנית ${s.technicalLevel}`],
  ]
  return `<table style="border-collapse:collapse;font-size:15px;margin:8px 0">${rows
    .map(([k, v]) => `<tr><td style="padding:5px 0 5px 14px;font-weight:700;white-space:nowrap">${k}</td><td style="padding:5px 0">${esc(v)}</td></tr>`)
    .join('')}</table>`
}

const EQUIPMENT =
  'קסדה (חובה), אופניים תקינים, לפחות 1.5 ליטר מים, חטיף או ארוחת בוקר קלה ופנימית רזרבית.'

async function send(to: string, subject: string, html: string, ics: string | null): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to,
      replyTo: REPLY_TO,
      subject,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">${html}</div>`,
      attachments: ics
        ? [{ filename: 'teva-bike-ride.ics', content: Buffer.from(ics, 'utf-8'), contentType: 'text/calendar' }]
        : undefined,
    })
    if (error) console.error('[ride-emails] resend error:', error)
    return !error
  } catch (e) {
    console.error('[ride-emails] send failed:', e)
    return false
  }
}

export async function sendRideConfirmation(s: RideSession, r: {
  email: string
  first_name: string
  rider_type: RiderType
  price: number
  included: boolean
  payUrl: string | null
  wants_rental: boolean
}): Promise<boolean> {
  const month = monthLabel(monthOf(s.date))
  const pay = r.included
    ? `<p>✅ הטיול כלול במנוי החודשי שלך ל${month} — אין צורך בתשלום נוסף.</p>`
    : `<p>${r.rider_type === 'subscriber'
        ? `נרשמת למנוי החודשי של ${month} (${r.price} ₪) — הוא כולל את ${TRIPS_PER_MONTH} הטיולים של החודש. לטיול השני פשוט נרשמים שוב באתר עם אותו מספר טלפון, בלי תשלום נוסף.`
        : `נרשמת לטיול בודד כרוכב/ת טבע בייק (${r.price} ₪).`}</p>
       <p><b>המקום נשמר אך ורק לאחר ביצוע תשלום.</b></p>
       ${r.payUrl ? button(r.payUrl, `לתשלום · ${r.price} ₪`) : '<p>קישור לתשלום יישלח אליך בוואטסאפ.</p>'}`
  const rental = r.wants_rental
    ? `<p>🚲 ביקשת אופניים חשמליים בהשכרה — ${RENTAL_PRICE} ₪, בתשלום נפרד.</p>${button(RENTAL_PAY_URL, `תשלום על השכרת האופניים · ${RENTAL_PRICE} ₪`, true)}`
    : ''

  return send(
    r.email,
    `נרשמת לטיול רכיבה — ${s.title} · ${s.dateLabel}`,
    `<h2 style="margin:0 0 10px">היי ${esc(r.first_name)}, נרשמת! 🚵</h2>
     <p>שמחים שבאת איתנו לטיול <b>${esc(s.title)}</b>.</p>
     ${detailsTable(s)}
     ${pay}
     ${rental}
     <p><b>מה להביא:</b> ${EQUIPMENT}</p>
     <p>צירפנו את הטיול ליומן. יומיים לפני נשלח תזכורת עם כל הפרטים.</p>
     ${button(`${SITE}/rides/${s.slug}`, 'לדף הטיול', true)}
     <p>שאלות? פשוט עונים למייל הזה.<br/>נתראה בשטח,<br/>טבע בייק</p>`,
    tripIcs(s)
  )
}

export async function sendRideReminder(s: RideSession, r: { email: string; first_name: string; wants_rental: boolean }): Promise<boolean> {
  return send(
    r.email,
    `תזכורת: טיול רכיבה ${s.title} — ${s.dateLabel}`,
    `<h2 style="margin:0 0 10px">היי ${esc(r.first_name)}, עוד יומיים יוצאים לרכוב! 🚵</h2>
     <p>תזכורת לטיול <b>${esc(s.title)}</b>:</p>
     ${detailsTable(s)}
     ${s.navUrl ? button(s.navUrl, '🧭 ניווט לנקודת המפגש') : ''}
     <p><b>מה להביא:</b> ${EQUIPMENT}</p>
     ${r.wants_rental ? '<p>🚲 האופניים החשמליים שהזמנת יחכו לך בנקודת המפגש.</p>' : ''}
     <p>מגיעים כמה דקות לפני השעה — יוצאים לדרך בזמן.</p>
     <p>משהו השתנה ולא תוכל/י להגיע? עונים למייל הזה ומשחררים את המקום למישהו אחר.</p>
     <p>נתראה בשטח,<br/>טבע בייק</p>`,
    tripIcs(s)
  )
}
