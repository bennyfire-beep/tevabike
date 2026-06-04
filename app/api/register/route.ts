import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'bennyfire@gmail.com'
const ADMIN_PHONE = '972525708084'

type RegisterData = {
  firstName: string; lastName: string; phone: string
  email?: string; branch?: string; classType: string
  registrationType: 'child' | 'adult'
  childName?: string; childAge?: string; notes?: string
}

export async function POST(request: NextRequest) {
  let body: RegisterData
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { firstName, lastName, phone, classType } = body
  if (!firstName || !phone || !classType)
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { error: dbErr } = await supabase.from('registrations').insert({
      full_name: `${firstName} ${lastName}`.trim(), phone,
      email: body.email || null, branch: body.branch || null,
      class_type: classType, child_name: body.childName || null,
      child_age: body.childAge ? parseInt(body.childAge) : null,
      notes: body.notes || null, status: 'pending',
    })
    if (dbErr) console.error('DB insert error:', dbErr)
  }

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'טבע בייק <noreply@tevabike.co.il>',
        to: [ADMIN_EMAIL],
        subject: `הרשמה חדשה: ${firstName} ${lastName} — ${classType}`,
        html: `<div dir="rtl"><h2>הרשמה חדשה</h2><p>שם: ${firstName} ${lastName}</p><p>טלפון: ${phone}</p><p>חוג: ${classType}</p><p>סניף: ${body.branch || 'לא צוין'}</p></div>`,
      }),
    }).catch(err => console.error('Resend error:', err))
  }

  const waText = encodeURIComponent(`הרשמה חדשה לטבע בייק!\nשם: ${firstName} ${lastName}\nטלפון: ${phone}\nחוג: ${classType}${body.branch ? ` | ${body.branch}` : ''}`)
  return NextResponse.json({ success: true, whatsappUrl: `https://wa.me/${ADMIN_PHONE}?text=${waText}` })
}
