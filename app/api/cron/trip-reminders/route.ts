import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ============================================================
// נתיב: app/api/cron/trip-reminders/route.ts
// רץ פעם ביום. שולח 4 תזכורות אוטומטיות לנרשמים.
//
//  110 יום לפני  →  תשלום יתרה
//  105 יום לפני  →  נספח ציוד
//   90 יום לפני  →  ביטוח נסיעות
//   60 יום לפני  →  סדנת הכנה
//
// כל מייל נשלח פעם אחת בלבד (unique על registration_id + kind)
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 60

const MILESTONES = [
  { days: 110, kind: 'payment' },
  { days: 105, kind: 'equipment' },
  { days: 90, kind: 'insurance' },
  { days: 60, kind: 'workshop' },
] as const

type Kind = (typeof MILESTONES)[number]['kind']

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
  // Vercel Cron sends this header; also allow a manual secret for testing
  const isCron = req.headers.get('x-vercel-cron') !== null
  const secret = req.nextUrl.searchParams.get('secret')
  if (!isCron && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = admin()
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sent: string[] = []
  const failed: string[] = []

  const { data: trips } = await db
    .from('trips')
    .select('*')
    .eq('reminders_on', true)

  for (const trip of trips ?? []) {
    const start = new Date(trip.trip_start + 'T00:00:00')
    const daysOut = Math.round(
      (start.getTime() - today.getTime()) / 86_400_000
    )

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

    // who already got this email
    const { data: already } = await db
      .from('trip_emails')
      .select('registration_id')
      .eq('trip_id', trip.id)
      .eq('kind', milestone.kind)
    const done = new Set((already ?? []).map((r) => r.registration_id))

    for (const rider of riders) {
      if (done.has(rider.id)) continue
      if (!rider.email) continue

      const mail = buildEmail(milestone.kind, {
        trip,
        rider,
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
        sent.push(`${milestone.kind}:${rider.id}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await db.from('trip_emails').insert({
          trip_id: trip.id,
          registration_id: rider.id,
          kind: milestone.kind,
          error: msg,
        })
        failed.push(`${milestone.kind}:${rider.id}`)
      }
    }

    // summary to Benny
    if (sent.length || failed.length) {
      try {
        await resend.emails.send({
          from: 'Teva Bike <info@mail.tevabike.com>',
          to: 'bennyfire@gmail.com',
          subject: `תזכורות ${milestone.days} יום — ${trip.title} (${sent.length} נשלחו)`,
          text: [
            `${trip.title}`,
            `אבן דרך: ${milestone.days} יום לפני היציאה — ${labelOf(milestone.kind)}`,
            `נרשמים: ${headcount}`,
            `מחיר בתוקף: €${price}`,
            ``,
            `נשלחו: ${sent.length}`,
            failed.length ? `נכשלו: ${failed.length}` : '',
            riders.filter((r) => !r.email).length
              ? `בלי אימייל: ${riders.filter((r) => !r.email).length} — צריך לשלוח להם בוואטסאפ`
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

  return NextResponse.json({ ok: true, sent: sent.length, failed: failed.length })
}

function labelOf(kind: Kind) {
  return {
    payment: 'תשלום יתרה',
    equipment: 'נספח ציוד',
    insurance: 'ביטוח נסיעות',
    workshop: 'סדנת הכנה',
  }[kind]
}

// ------------------------------------------------------------
// the four emails
// ------------------------------------------------------------
function buildEmail(
  kind: Kind,
  ctx: {
    trip: any
    rider: { name_he: string }
    headcount: number
    price: number
  }
) {
  const { trip, rider, headcount, price } = ctx
  const name = rider.name_he.split(' ')[0]
  const sign = `\n\nבני\nטבע בייק\n054-570-8084`

  if (kind === 'payment')
    return {
      subject: `${trip.title} — תשלום יתרה`,
      body:
        `היי ${name},\n\n` +
        `נשארו כ-110 ימים ל${trip.title}, וזה הזמן לסגור את התשלום.\n\n` +
        `נרשמו לטיול ${headcount} רוכבים, ולכן המחיר הסופי שלך הוא €${price.toLocaleString()}.\n` +
        `מהסכום הזה יורדת המקדמה של ₪${trip.deposit_ils} ששילמת בהרשמה.\n\n` +
        `היתרה תחושב לפי שער העברות והמחאות ביום התשלום, כפי שמופיע בתנאים.\n` +
        `יש להשלים את התשלום עד ${trip.balance_days_before} יום לפני היציאה.\n\n` +
        `אשלח לך פרטי העברה בוואטסאפ. אם נוח לך לשלם באשראי — תגיד לי ואסדר.\n\n` +
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
        `1. במורזין חובה קסדת Full Face וחליפת לחץ. זה לא המלצה.\n` +
        `2. "אוזן" אחורית רזרבית — ייחודית לכל דגם אופניים, חייבים להזמין מראש.\n` +
        `3. בדיקת אופניים אצל מכונאי — בלמים, צמיגים, שרשרת. עכשיו, לא ביוני.\n\n` +
        (trip.equipment_doc_url
          ? `הנספח המלא:\n${trip.equipment_doc_url}\n\n`
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

  // workshop
  return {
    subject: `${trip.title} — סדנת הכנה, 60 יום לצאת`,
    body:
      `היי ${name},\n\n` +
      `נשארו חודשיים. זה בדיוק הזמן להתחיל להתכונן פיזית וטכנית.\n\n` +
      `הירידות במורזין ארוכות בהרבה ממה שאנחנו רגילים אליו בארץ — ` +
      `ירידה אחת יכולה להיות 1,400 מטר ברצף. הידיים והרגליים מרגישות את זה ` +
      `ביום השני אם לא מגיעים מוכנים.\n\n` +
      `אנחנו מריצים סדנת הכנה לרכיבת אלפים, ` +
      `${trip.workshop_price_ils ? `במחיר מיוחד של ₪${trip.workshop_price_ils} ` : 'במחיר מיוחד '}` +
      `לנרשמי הטיול.\n\n` +
      `בסדנה: עבודה על מיקום גוף בירידות ארוכות, בלימה נכונה שלא שורפת אצבעות, ` +
      `וקריאת מסלול במהירות.\n\n` +
      (trip.workshop_url ? `לפרטים והרשמה:\n${trip.workshop_url}\n\n` : '') +
      `גם אם לא תגיע לסדנה — תתחיל לרכב יותר ולעבוד על אחיזה. ` +
      `זה ישתלם לך ביום הראשון.` +
      sign,
  }
}
