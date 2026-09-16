import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// נתיב: app/api/hashlama/route.ts
// אימון השלמה — יום שלישי 22.9, רקפת. ללא עלות, ללא הגבלת מקומות —
// GET  — סה"כ נרשמים (למד חי בעמוד הציבורי)
// POST — הרשמה חדשה
// ============================================================

export const dynamic = 'force-dynamic'

const BRANCH_LABEL: Record<string, string> = { misgav: 'משגב', matzuva: 'מצובה', biriya: 'ביריה' }
const GROUP_LABEL: Record<string, string> = { beginners: 'גרביטי מתחילים', mini: 'מיני גרביטי', pro: 'גרביטי פרו' }

const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

export async function GET() {
  const db = admin()

  const { count, error } = await db
    .from('hashlama_registrations')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('[hashlama] GET failed:', error)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

async function notifyBenny(r: {
  first_name: string
  last_name: string
  phone: string
  branch: string
  group_type: string
  count: number
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently, registration is already saved

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com'],
        subject: `הרשמה לאימון השלמה — ${r.first_name} ${r.last_name} (סה"כ ${r.count})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚵 הרשמה חדשה לאימון השלמה — 22.9</h2>
          <table style="border-collapse:collapse;font-size:15px">
            <tr><td style="padding:6px 12px;font-weight:700">שם</td><td style="padding:6px 12px">${r.first_name} ${r.last_name}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">טלפון</td><td style="padding:6px 12px">${r.phone}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">סניף</td><td style="padding:6px 12px">${BRANCH_LABEL[r.branch] ?? r.branch}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">קבוצה</td><td style="padding:6px 12px">${GROUP_LABEL[r.group_type] ?? r.group_type}</td></tr>
            <tr><td style="padding:6px 12px;font-weight:700">נרשמו עד כה</td><td style="padding:6px 12px">${r.count}</td></tr>
          </table>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[hashlama] notification failed (registration was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const first_name = String(body.first_name ?? '').trim().slice(0, 60)
    const last_name = String(body.last_name ?? '').trim().slice(0, 60)
    const phone = String(body.phone ?? '').trim().slice(0, 20)
    const branch = String(body.branch ?? '')
    const group_type = String(body.group_type ?? '')

    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'חסרים שם פרטי ושם משפחה' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון לא תקין' }, { status: 400 })
    }
    if (!['misgav', 'matzuva', 'biriya'].includes(branch)) {
      return NextResponse.json({ error: 'יש לבחור סניף' }, { status: 400 })
    }
    if (!['beginners', 'mini', 'pro'].includes(group_type)) {
      return NextResponse.json({ error: 'יש לבחור קבוצה' }, { status: 400 })
    }

    const db = admin()

    const { error: insErr } = await db
      .from('hashlama_registrations')
      .insert({ first_name, last_name, phone, branch, group_type })

    if (insErr) {
      console.error('[hashlama] insert failed:', insErr)
      return NextResponse.json({ error: 'לא הצלחנו לשמור. נסו שוב.' }, { status: 500 })
    }

    const { count } = await db
      .from('hashlama_registrations')
      .select('id', { count: 'exact', head: true })

    void notifyBenny({ first_name, last_name, phone, branch, group_type, count: count ?? 0 })

    return NextResponse.json({ ok: true, count: count ?? 0 })
  } catch (e) {
    console.error('[hashlama] POST error:', e)
    return NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
