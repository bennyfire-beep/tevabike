import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { registration_id, group_id } = await req.json()
    if (!registration_id || !group_id) {
      return NextResponse.json({ error: 'חסר מזהה הרשמה או קבוצה' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. משיכת ההרשמה והקבוצה
    const { data: reg, error: regErr } = await supabase
      .from('registrations').select('*').eq('id', registration_id).single()
    if (regErr || !reg) return NextResponse.json({ error: 'ההרשמה לא נמצאה' }, { status: 404 })

    const { data: group, error: grpErr } = await supabase
      .from('groups').select('*').eq('id', group_id).single()
    if (grpErr || !group) return NextResponse.json({ error: 'הקבוצה לא נמצאה' }, { status: 404 })

    // 2. ילדים או מבוגרים – נקבע לפי סוג הקבוצה, לא לפי הטופס
    const isKids = group.type !== 'adults'
    const riderName = isKids ? reg.child_name || reg.full_name : reg.full_name

    const { data: rider, error: riderErr } = await supabase
      .from('riders')
      .insert({
        full_name: riderName,
        // אצל ילדים ההורה הוא איש הקשר; אצל מבוגרים הרוכב הוא איש הקשר
        parent_name: isKids ? reg.full_name : null,
        parent_phone: isKids ? reg.phone : null,
        phone: isKids ? null : reg.phone,
        email: reg.email,
        age: reg.child_age,
        branch: group.branch,
        group_id: group.id,
        group_name: group.name,
        is_child: isKids,
        is_regular: true,
        active: true,
        notes: reg.city ? `יישוב: ${reg.city}${reg.notes ? ` · ${reg.notes}` : ''}` : reg.notes,
      })
      .select()
      .single()
    if (riderErr) {
      console.error('rider insert failed:', riderErr)
      return NextResponse.json({ error: 'יצירת הרוכב נכשלה' }, { status: 500 })
    }

    // 3. שיוך לקבוצה – זה מה שמכניס אותו למסכי הנוכחות
    await supabase.from('rider_groups').insert({ rider_id: rider.id, group_id: group.id })

    // 4. שליחת קישור Arbox במייל
    const arboxLink = group.arbox_link || process.env.ARBOX_DEFAULT_LINK || null
    let emailSent = false

    if (arboxLink && reg.email && process.env.RESEND_API_KEY) {
      const greeting = isKids ? `היי ${reg.full_name},` : `היי ${reg.full_name},`
      const line = isKids
        ? `שיבצנו את ${riderName} לקבוצת <b>${group.name}</b> בסניף ${group.branch}${group.days ? `, אימונים ב${group.days}` : ''}.`
        : `שיבצנו אותך לקבוצת <b>${group.name}</b> בסניף ${group.branch}${group.days ? `, אימונים ב${group.days}` : ''}.`
      const subject = isKids
        ? `${riderName} שובץ לקבוצת ${group.name} – השלמת הרשמה`
        : `שובצת לקבוצת ${group.name} – השלמת הרשמה`

      const html = `
        <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#1c1917">
          <h2 style="color:#3f6212">ברוכים הבאים לטבע בייק 🚵</h2>
          <p>${greeting}</p>
          <p>${line}</p>
          <p>להשלמת ההרשמה יש להסדיר את התשלום בקישור הבא. בסיום התשלום יישלחו במייל נפרד שם משתמש וסיסמה לאפליקציית טבע בייק, שבה אפשר לראות את לוח האימונים ולעדכן פרטים.</p>
          <p style="margin:28px 0">
            <a href="${arboxLink}" style="background:#65a30d;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
              להסדרת התשלום והצטרפות לאפליקציה
            </a>
          </p>
          <p style="color:#78716c;font-size:14px">שאלות? פשוט השיבו למייל הזה או התקשרו.</p>
          <p style="color:#78716c;font-size:14px">נתראה על השבילים,<br/>בני – טבע בייק</p>
        </div>`

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'טבע בייק <info@mail.tevabike.com>',
          to: [reg.email],
          subject,
          html,
        }),
      })
      emailSent = r.ok
      if (!r.ok) console.error('resend failed:', await r.text())
    }

    // 5. עדכון ההרשמה
    await supabase
      .from('registrations')
      .update({
        status: 'approved',
        group_id: group.id,
        group_name: group.name,
        rider_id: rider.id,
        approved_at: new Date().toISOString(),
        arbox_link: arboxLink,
        arbox_sent_at: emailSent ? new Date().toISOString() : null,
      })
      .eq('id', registration_id)

    // 6. גיבוי בוואטסאפ
    const phone = String(reg.phone).replace(/\D/g, '').replace(/^0/, '972')
    const body = isKids
      ? `היי ${reg.full_name}, ${riderName} שובץ לקבוצת ${group.name} בסניף ${group.branch} 🚵`
      : `היי ${reg.full_name}, שובצת לקבוצת ${group.name} בסניף ${group.branch} 🚵`
    const text = encodeURIComponent(
      body + (arboxLink ? `\nלהסדרת התשלום והצטרפות לאפליקציה: ${arboxLink}` : '')
    )

    return NextResponse.json({
      ok: true,
      group_name: group.name,
      rider_id: rider.id,
      is_kids: isKids,
      email_sent: emailSent,
      whatsapp_url: `https://wa.me/${phone}?text=${text}`,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
