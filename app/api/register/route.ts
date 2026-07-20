import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const ADMIN_PHONE = '972525708084'
const FROM = 'טבע בייק <info@mail.tevabike.com>'

type RegisterData = {
  firstName: string; lastName: string; phone: string
  email?: string; branch?: string; classType: string
  registrationType?: 'child' | 'adult'
  childName?: string; childAge?: string; notes?: string
}

async function sendEmail(to: string[], subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[register] RESEND_API_KEY missing'); return }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) console.error('[register] resend failed:', res.status, await res.text())
  } catch (err) {
    console.error('[register] resend error:', err)
  }
}

export async function POST(request: NextRequest) {
  let body: RegisterData
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const firstName = (body.firstName ?? '').trim()
  const lastName  = (body.lastName ?? '').trim()
  const phone     = (body.phone ?? '').trim()
  const classType = (body.classType ?? '').trim()
  const email     = (body.email ?? '').trim()

  if (!firstName || !phone || !classType)
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })

  const fullName = `${firstName} ${lastName}`.trim()

  // ── שמירה במסד ──────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  let saved = false
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey)
    const { error } = await supabase.from('registrations').insert({
      full_name: fullName,
      phone,
      email: email || null,
      branch: body.branch || null,
      class_type: classType,
      registration_type: body.registrationType || null,
      child_name: body.childName || null,
      child_age: body.childAge ? parseInt(body.childAge) : null,
      notes: body.notes || null,
      status: 'pending',
    })
    if (error) console.error('[register] DB insert failed:', error.message)
    else saved = true
  } else {
    console.error('[register] Supabase env missing')
  }

  const rows = [
    ['שם', fullName],
    ['טלפון', phone],
    ['אימייל', email || '—'],
    ['חוג', classType],
    ['סניף', body.branch || '—'],
    ['שם הילד', body.childName || '—'],
    ['גיל', body.childAge || '—'],
    ['הערות', body.notes || '—'],
  ].map(([k, v]) => `<p style="margin:4px 0"><b>${k}:</b> ${v}</p>`).join('')

  // ── מייל אליך ───────────────────────────────────────────────
  await sendEmail(
    ADMIN_EMAILS,
    `הרשמה חדשה: ${fullName} — ${classType}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
       <h2 style="margin:0 0 12px">הרשמה חדשה מהאתר</h2>
       ${rows}
       ${saved ? '' : '<p style="color:#b00"><b>שים לב:</b> ההרשמה לא נשמרה במסד הנתונים. שמור את הפרטים ידנית.</p>'}
       <p style="margin-top:16px">
         <a href="https://www.tevabike.com/admin/coordinator/registrations">לעמוד ההרשמות</a>
       </p>
     </div>`,
  )

  // ── מייל אישור לנרשם ────────────────────────────────────────
  if (email) {
    await sendEmail(
      [email],
      'קיבלנו את ההרשמה שלך — טבע בייק',
      `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#1a1a1a;max-width:560px">
         <h2 style="margin:0 0 6px">תודה, ${firstName} 🚵</h2>
         <p style="margin:0 0 18px;color:#555">קיבלנו את פנייתך ונחזור אליך בקרוב לתיאום.</p>
         <div style="background:#f6f6f4;border-radius:10px;padding:14px">${rows}</div>
         <p style="margin-top:20px;color:#666;font-size:13px">
           רוצה לזרז? אפשר לכתוב לנו ישירות בוואטסאפ: 052-5708084
         </p>
       </div>`,
    )
  }

  const waText = encodeURIComponent(
    `הרשמה חדשה לטבע בייק!\nשם: ${fullName}\nטלפון: ${phone}\nחוג: ${classType}${body.branch ? ` | ${body.branch}` : ''}`,
  )

  return NextResponse.json({
    success: true,
    saved,
    whatsappUrl: `https://wa.me/${ADMIN_PHONE}?text=${waText}`,
  })
}
