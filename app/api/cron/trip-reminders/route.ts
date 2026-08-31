import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ============================================================
// נתיב: app/api/cron/trip-reminders/route.ts
// רץ פעם ביום ב-06:00. שולח תזכורות אוטומטיות לנרשמים.
//
//  110 יום לפני  →  תשלום יתרה (לפי מספר הנרשמים בפועל)
//  105 יום לפני  →  נספח ציוד ואריזת אופניים
//   90 יום לפני  →  ביטוח נסיעות
//   60 יום לפני  →  סדנת הכנה
//   30 יום לפני  →  בקשת פרטי טיסה (להזמנת הסעות)
//   10 יום לפני  →  פרטים אחרונים והסעות
//
// כל מייל נשלח פעם אחת בלבד לכל נרשם
// (unique על registration_id + kind בטבלת trip_emails)
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 60

const MILESTONES = [
  { days: 110, kind: 'payment' },
  { days: 105, kind: 'equipment' },
  { days: 90, kind: 'insurance' },
  { days: 60, kind: 'workshop' },
  { days: 30, kind: 'flights' },
  { days: 10, kind: 'final' },
] as const

type Kind = (typeof MILESTONES)[number]['kind']

const LABELS: Record<Kind, string> = {
  payment: 'תשלום יתרה',
  equipment: 'נספח ציוד',
  insurance: 'ביטוח נסיעות',
  workshop: 'סדנת הכנה',
  flights: 'בקשת פרטי טיסה',
  final: 'פרטים אחרונים',
}

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

const heDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export async function GET(req: NextRequest) {
  // Vercel Cron sends this header; a secret also allows manual testing
  const isCron = req.headers.get('x-vercel-cron') !== null
  const secret = req.nextUrl.searchParams.get('secret')
  if (!isCron && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = admin()
  const resend = new Resend(process.env.RESEND_API_KEY!)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let totalSent = 0
  let totalFailed = 0

  const { data: trips } = await db
    .from('trips')
    .select('*')
    .eq('reminders_on', true)

  for (const trip of trips ?? []) {
    const start = new Date(trip.trip_start + 'T00:00:00')
    const daysOut = Math.round((start.getTime() - today.getTime()) / 86_400_000)

    const milestone = MILESTONES.find((m) => m.days === daysOut)
    if (!milestone) continue

    // live headcount → the price everyone actually pays
    const { data: regs } = await db
      .from('trip_registrations')
      .select('id, name_he, email, payment_status')
      .eq('trip_id', trip.id)
      .neq('payment_status', 'cancelled')

    const riders = regs ?? []
    const headcount = riders.length
    const price =
      headcount > trip.size_small
        ? Number(trip.price_large_group)
        : Number(trip.price_small_group)

    // who already got this particular email
    const { data: already } = await db
      .from('trip_emails')
      .select('registration_id')
      .eq('trip_id', trip.id)
      .eq('kind', milestone.kind)
    const done = new Set((already ?? []).map((r) => r.registration_id))

    let sent = 0
    let failed = 0
    let noEmail = 0

    for (const rider of riders) {
      if (done.has(rider.id)) continue
      if (!rider.email) {
        noEmail++
        continue
      }

      const mail = buildEmail(milestone.kind, {
        trip,
        name: rider.name_he.split(' ')[0],
        headcount,
        price,
      })

      try {
        const res = await resend.emails.send({
          from: 'Teva Bike <info@mail.tevabike.com>',
          to: rider.email,
          replyTo: 'bennyfire@gmail.com',
          subject: mail.subject,
          text: mail.body,
        })
        await db.from('trip_emails').insert({
          trip_id: trip.id,
          registration_id: rider.id,
          kind: milestone.kind,
          resend_id: res.data?.id ?? null,
        })
        sent++
      } catch (e) {
        await db.from('trip_emails').insert({
          trip_id: trip.id,
          registration_id: rider.id,
          kind: milestone.kind,
          error: e instanceof Error ? e.message : String(e),
        })
        failed++
      }
    }

    totalSent += sent
    totalFailed += failed

    // summary to Benny
    if (sent || failed || noEmail) {
      try {
        await resend.emails.send({
          from: 'Teva Bike <info@mail.tevabike.com>',
          to: 'bennyfire@gmail.com',
          subject: `תזכורות ${milestone.days} יום — ${trip.title} (${sent} נשלחו)`,
          text: [
            trip.title,
            `אבן דרך: ${milestone.days} יום לפני היציאה — ${LABELS[milestone.kind]}`,
            `נרשמים: ${headcount}`,
            `מחיר בתוקף: €${price}`,
            '',
            `נשלחו: ${sent}`,
            failed ? `נכשלו: ${failed}` : '',
            noEmail ? `בלי אימייל: ${noEmail} — צריך לשלוח להם בוואטסאפ` : '',
            '',
            milestone.kind === 'flights'
              ? 'התשובות עם כרטיסי הטיסה יגיעו לתיבה הזו. אחרי שיאספו — להזמין הסעות.'
              : '',
            milestone.kind === 'final' && !trip.final_details
              ? 'שים לב: לא מילאת את שדה final_details, אז לא נשלחו פרטי הסעה.'
              : '',
          ]
            .filter(Boolean)
            .join('\n'),
        })
      } catch {
        /* summary is best-effort */
      }
    }
  }

  return NextResponse.json({ ok: true, sent: totalSent, failed: totalFailed })
}

// ------------------------------------------------------------
// the six emails
// ------------------------------------------------------------
function buildEmail(
  kind: Kind,
  ctx: { trip: any; name: string; headcount: number; price: number }
): { subject: string; body: string } {
  const { trip, name, headcount, price } = ctx
  const sign = '\n\nבני\nטבע בייק\n054-570-8084'

  if (kind === 'payment')
    return {
      subject: `${trip.title} — תשלום יתרה`,
      body:
        `היי ${name},\n\n` +
        `נשארו כ-110 ימים ל${trip.title}, וזה הזמן לסגור את התשלום.\n\n` +
        `נרשמו לטיול ${headcount} רוכבים, ולכן המחיר הסופי שלך הוא ` +
        `€${price.toLocaleString()}.\n` +
        `מהסכום הזה יורדת המקדמה של ₪${trip.deposit_ils} ששילמת בהרשמה.\n\n` +
        `היתרה תחושב לפי שער העברות והמחאות ביום התשלום, כפי שמופיע בתנאים.\n` +
        `יש להשלים את התשלום עד ${trip.balance_days_before} יום לפני היציאה.\n\n` +
        (trip.bank_details
          ? `להעברה בנקאית:\n${trip.bank_details}\n\n`
          : `אשלח לך פרטי העברה בהודעה נפרדת.\n\n`) +
        `--------------------------------------------\n` +
        `ביטוח נסיעות — לעשות עכשיו\n` +
        `--------------------------------------------\n` +
        `מומלץ מאוד לרכוש ביטוח נסיעות כבר עכשיו, ולא לקראת הטיול. ביטוח ` +
        `שנרכש כ-90 יום מראש מכסה גם ביטול או קיצור של הטיול עקב פציעה או ` +
        `בעיה רפואית — כיסוי שלא ניתן לקבל אם רוכשים אותו סמוך ליציאה.\n\n` +
        `חשוב לוודא שהפוליסה כוללת ספורט אתגרי ורכיבת אופני הרים — ביטוח ` +
        `נסיעות רגיל לא מכסה את זה.\n\n` +
        (trip.insurance_agent
          ? `לשאלות ולרכישה: ${trip.insurance_agent} — ${trip.insurance_phone}\n\n`
          : '') +
        `החופשה: ${heDate(trip.trip_start)} עד ${heDate(trip.trip_end)}` +
        sign,
    }

  if (kind === 'equipment')
    return {
      subject: `${trip.title} — נספח ציוד ואריזת אופניים`,
      body:
        `היי ${name},\n\n` +
        `מצרף את נספח הציוד לחופשה. כדאי לקרוא אותו עכשיו ולא שבוע לפני — ` +
        `חלק מהדברים דורשים הזמנה מראש.\n\n` +
        `שלוש נקודות שאני מדגיש כל שנה:\n\n` +
        `1. במורזין חובה קסדת Full Face וחליפת לחץ. זו לא המלצה.\n` +
        `2. "אוזן" אחורית רזרבית — ייחודית לכל דגם אופניים, חייבים להזמין מראש.\n` +
        `3. בדיקת אופניים אצל מכונאי — בלמים, צמיגים, שרשרת. עכשיו, לא ביוני.\n\n` +
        (trip.equipment_doc_url
          ? `הנספח המלא:\n${trip.equipment_doc_url}\n\n`
          : '') +
        (trip.rental_shop_name
          ? `אם אתה שוכר אופניים ב${trip.rental_shop_name} — הקסדה, חליפת ` +
            `הלחץ ומגיני הברכיים כלולים בהשכרה, אז אין צורך להביא אותם.\n\n`
          : '') +
        `שאלות על ציוד — תכתוב לי, אני שמח לעזור.` +
        sign,
    }

  if (kind === 'insurance')
    return {
      subject: `${trip.title} — ביטוח נסיעות, חובה`,
      body:
        `היי ${name},\n\n` +
        `נשארו ${trip.balance_days_before} יום לחופשה, וזה הזמן לסדר ביטוח.\n\n` +
        `ביטוח הוא חובה בטיול הזה. רכיבת הרים במורזין דורשת פוליסה ` +
        `לספורט אתגרי שכוללת חילוץ אווירי, הטסה רפואית, אשפוז וניתוחים. ` +
        `ביטוח נסיעות רגיל לא יכסה אותך אם תיפול על סינגל.\n\n` +
        `רכישת הביטוח באחריותך. אם תרצה, סוכן הביטוח שאנחנו עובדים איתו:\n` +
        `${trip.insurance_agent} — ${trip.insurance_phone}\n\n` +
        `מומלץ גם ביטוח מטען, במיוחד אם אתה טס עם האופניים שלך.\n\n` +
        `כשסידרת — תעדכן אותי.` +
        sign,
    }

  if (kind === 'workshop')
    return {
      subject: `${trip.title} — סדנת הכנה, 60 יום לצאת`,
      body:
        `היי ${name},\n\n` +
        `נשארו חודשיים. זה בדיוק הזמן להתחיל להתכונן פיזית וטכנית.\n\n` +
        `הירידות במורזין ארוכות בהרבה ממה שאנחנו רגילים אליו בארץ — ` +
        `ירידה אחת יכולה להיות 1,400 מטר ברצף. הידיים והרגליים מרגישות ` +
        `את זה ביום השני אם לא מגיעים מוכנים.\n\n` +
        `אנחנו מריצים סדנת הכנה לרכיבת אלפים` +
        (trip.workshop_price_ils
          ? `, במחיר מיוחד של ₪${trip.workshop_price_ils} לנרשמי הטיול.\n\n`
          : `, במחיר מיוחד לנרשמי הטיול.\n\n`) +
        `בסדנה: עבודה על מיקום גוף בירידות ארוכות, בלימה נכונה שלא שורפת ` +
        `אצבעות, וקריאת מסלול במהירות.\n\n` +
        (trip.workshop_url ? `לפרטים והרשמה:\n${trip.workshop_url}\n\n` : '') +
        `גם אם לא תגיע לסדנה — תתחיל לרכב יותר ולעבוד על אחיזה. ` +
        `זה ישתלם לך ביום הראשון.` +
        sign,
    }

  if (kind === 'flights')
    return {
      subject: `${trip.title} — צריך את פרטי הטיסה שלך`,
      body:
        `היי ${name},\n\n` +
        `נשאר חודש. אני מזמין עכשיו את ההסעות משדה התעופה בז׳נבה, ` +
        `ובשביל זה אני צריך לדעת מתי כל אחד נוחת ומתי טס חזרה.\n\n` +
        `תשיב למייל הזה עם צילום של כרטיס הטיסה, או פשוט תכתוב לי:\n\n` +
        `- מספר טיסת ההלוך ושעת הנחיתה בז׳נבה\n` +
        `- מספר טיסת החזור ושעת ההמראה מז׳נבה\n\n` +
        `חשוב שזה יגיע בימים הקרובים. ההסעה מסודרת לפי שעות הנחיתה בפועל, ` +
        `ואם פרט אחד חסר — כל הקבוצה מחכה.\n\n` +
        `בערך עשרה ימים לפני היציאה אשלח לכולם את הפרטים הסופיים: ` +
        `שעת איסוף, נקודת מפגש וטלפונים לחירום.` +
        sign,
    }

  // final
  return {
    subject: `${trip.title} — פרטים אחרונים לפני היציאה`,
    body:
      `היי ${name},\n\n` +
      `עשרה ימים. הנה כל מה שצריך לדעת:\n\n` +
      (trip.final_details
        ? `${trip.final_details}\n\n`
        : `פרטי ההסעה יישלחו בהודעה נפרדת.\n\n`) +
      `--------------------------------------------\n` +
      `לפני שאתה יוצא מהבית\n` +
      `--------------------------------------------\n` +
      `- דרכון בתוקף\n` +
      `- אישור ביטוח נסיעות לספורט אתגרי — שמור בטלפון\n` +
      `- קסדת Full Face וחליפת לחץ, או אישור השכרה\n` +
      `- "אוזן" אחורית רזרבית אם אתה מביא אופניים\n` +
      `- ציוד רכיבה בתיק היד ולא רק במזוודה, למקרה שהמזוודה מתעכבת\n\n` +
      (trip.emergency_phone
        ? `טלפון חירום שלי בחו״ל: ${trip.emergency_phone}\n`
        : '') +
      (trip.resort_contact ? `איש קשר במורזין: ${trip.resort_contact}\n` : '') +
      `\nנתראה שם.` +
      sign,
  }
}
