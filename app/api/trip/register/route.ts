import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// ============================================================
// נתיב: app/api/trip/register/route.ts
// שומר הרשמה, מעלה דרכון לבאקט פרטי, שולח התראה במייל
// ============================================================

export const runtime = 'nodejs'
export const maxDuration = 30

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

const MAX_FILE = 10 * 1024 * 1024 // 10MB
const OK_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
  'application/pdf',
]

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const slug = String(fd.get('slug') ?? '')
    const key = String(fd.get('k') ?? '')

    const db = admin()

    // ---- verify the trip and the access code ----
    const { data: trip } = await db
      .from('trips')
      .select('id, slug, title, access_code, is_open, deposit_ils, trip_start, trip_end, balance_days_before, bank_details, bit_phone, payment_note')
      .eq('slug', slug)
      .maybeSingle()

    if (!trip || !trip.is_open) {
      return NextResponse.json({ error: 'ההרשמה סגורה' }, { status: 404 })
    }
    if (key !== trip.access_code) {
      return NextResponse.json({ error: 'קישור לא תקין' }, { status: 403 })
    }

    // ---- required fields ----
    const s = (k: string) => String(fd.get(k) ?? '').trim()
    const required = [
      'name_he',
      'name_passport',
      'birth_date',
      'phone',
      'passport_number',
      'passport_expiry',
      'shirt_size',
    ]
    for (const f of required) {
      if (!s(f)) {
        return NextResponse.json(
          { error: 'חסרים פרטים בטופס' },
          { status: 400 }
        )
      }
    }
    if (s('terms_accepted') !== 'true') {
      return NextResponse.json(
        { error: 'צריך לאשר את תנאי הביטול' },
        { status: 400 }
      )
    }

    const wantsRental = s('wants_rental') === 'true'

    // ---- passport upload ----
    let passportPath: string | null = null
    const file = fd.get('passport')
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE) {
        return NextResponse.json(
          { error: 'הקובץ גדול מדי (מקסימום 10MB)' },
          { status: 400 }
        )
      }
      if (!OK_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: 'סוג קובץ לא נתמך' },
          { status: 400 }
        )
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const safeName = s('name_passport')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .slice(0, 40)
      passportPath = `${slug}/${Date.now()}-${safeName}.${ext}`

      const { error: upErr } = await db.storage
        .from('passports')
        .upload(passportPath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (upErr) {
        console.error('passport upload failed:', upErr)
        passportPath = null // save the registration anyway
      }
    }

    // ---- insert ----
    const { data: reg, error: insErr } = await db
      .from('trip_registrations')
      .insert({
        trip_id: trip.id,
        name_he: s('name_he'),
        name_passport: s('name_passport'),
        birth_date: s('birth_date'),
        phone: s('phone'),
        email: s('email') || null,
        passport_number: s('passport_number'),
        passport_expiry: s('passport_expiry'),
        passport_file: passportPath,
        shirt_size: s('shirt_size'),
        wants_rental: wantsRental,
        rental_height_cm: wantsRental && s('rental_height_cm')
          ? Number(s('rental_height_cm'))
          : null,
        rental_size: wantsRental ? s('rental_size') || null : null,
        wants_insurance: s('wants_insurance') === 'true',
        dietary: s('dietary') || null,
        notes: s('notes') || null,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        payment_status: 'pending',
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('registration insert failed:', insErr)
      return NextResponse.json(
        { error: 'לא הצלחנו לשמור. נסו שוב או כתבו לבני.' },
        { status: 500 }
      )
    }

    // ---- how many are registered now ----
    const { count } = await db
      .from('trip_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', trip.id)
      .neq('payment_status', 'cancelled')

    const resend = new Resend(process.env.RESEND_API_KEY!)

    // ---- confirmation to the rider, with payment details ----
    const riderEmail = s('email')
    if (riderEmail) {
      const firstName = s('name_he').split(' ')[0]
      try {
        await resend.emails.send({
          from: 'Teva Bike <info@mail.tevabike.com>',
          to: riderEmail,
          replyTo: 'bennyfire@gmail.com',
          subject: `נרשמת ל${trip.title} — פרטים להעברת המקדמה`,
          text: [
            `היי ${firstName},`,
            ``,
            `ההרשמה שלך ל${trip.title} התקבלה. מעולה שאתה איתנו.`,
            ``,
            `המקום נשמר ברגע שהמקדמה מתקבלת, אז כדאי לא לחכות —`,
            `יש מספר מקומות מוגבל בשאלה.`,
            ``,
            `--------------------------------------------`,
            `מקדמה: ${trip.deposit_ils} ש"ח`,
            `--------------------------------------------`,
            ``,
            trip.bank_details
              ? `להעברה בנקאית:\n${trip.bank_details}`
              : `פרטי ההעברה יישלחו אליך בוואטסאפ.`,
            ``,
            trip.bit_phone ? `או בביט: ${trip.bit_phone}` : '',
            ``,
            `אחרי ההעברה — פשוט תשיב למייל הזה עם צילום מסך של האישור.`,
            `אני עובר על המיילים ומאשר, ותקבל ממני הודעה שהמקום נשמר.`,
            `(אם נוח לך יותר בוואטסאפ — 054-570-8084)`,
            ``,
            trip.payment_note || '',
            ``,
            `יתרת התשלום עד ${trip.balance_days_before} יום לפני היציאה.`,
            `אעדכן אותך במחיר הסופי לפי מספר המשתתפים.`,
            ``,
            `מה שיגיע ממני בהמשך:`,
            `- נספח ציוד ואריזת אופניים`,
            `- תזכורת לביטוח נסיעות`,
            `- הצעה לסדנת הכנה לפני הנסיעה`,
            ``,
            `שאלות — אני זמין.`,
            ``,
            `בני`,
            `טבע בייק`,
            `054-570-8084`,
          ]
            .filter((l) => l !== '')
            .join('\n'),
        })
      } catch (mailErr) {
        console.error('rider confirmation failed:', mailErr)
      }
    }

    // ---- notify Benny (never block the response on this) ----
    try {
      await resend.emails.send({
        from: 'Teva Bike <info@mail.tevabike.com>',
        to: 'bennyfire@gmail.com',
        replyTo: s('email') || undefined,
        subject: `הרשמה חדשה — ${trip.title} — ${s('name_he')} (${count} נרשמו)`,
        text: [
          `${trip.title}`,
          `נרשמים עד כה: ${count}`,
          ``,
          `שם: ${s('name_he')}`,
          `דרכון: ${s('name_passport')}`,
          `לידה: ${s('birth_date')}`,
          `טלפון: ${s('phone')}`,
          `אימייל: ${s('email') || '—'}`,
          ``,
          `מס׳ דרכון: ${s('passport_number')}`,
          `תוקף: ${s('passport_expiry')}`,
          `צילום דרכון: ${passportPath ? 'הועלה' : 'לא הועלה'}`,
          ``,
          `חולצה: ${s('shirt_size')}`,
          `השכרת אופניים: ${
            wantsRental
              ? `כן — מידה ${s('rental_size')}, גובה ${s('rental_height_cm') || '—'} ס״מ`
              : 'לא'
          }`,
          `ביטוח — רוצה שניצור קשר: ${
            s('wants_insurance') === 'true' ? 'כן' : 'לא'
          }`,
          ``,
          `תזונה: ${s('dietary') || '—'}`,
          `הערות: ${s('notes') || '—'}`,
          ``,
          `לשלוח פרטי העברה למקדמה של ₪${trip.deposit_ils}`,
        ].join('\n'),
      })
    } catch (mailErr) {
      console.error('resend notification failed:', mailErr)
    }

    return NextResponse.json({ ok: true, id: reg.id, count })
  } catch (err) {
    console.error('register route error:', err)
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 })
  }
}
