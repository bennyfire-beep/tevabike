import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// רץ פעם ביום דרך Vercel Cron (מוגדר ב-vercel.json).
// מוצא חניכים שהחסירו פעמיים ברצף ושולח מייל לבני ולטל.
// כל חניך מדווח פעם אחת בלבד לכל תאריך היעדרות אחרון.

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RECIPIENTS = ['bennyfire@gmail.com', 'talmatoki@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'

type Att = { rider_id: string; date: string; status: string | null; present: boolean | null; rider_name: string | null }
type Rider = { id: string; full_name: string; phone: string | null; parent_phone: string | null; group_name: string | null; branch: string | null }

const isPresent = (a: Att) => a.status === 'present' || a.present === true
const fmt = (d: string) => new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ ok: false, error: 'env missing' }, { status: 500 })
  const db = createClient(url, key)

  // 60 הימים האחרונים מספיקים כדי לזהות רצף
  const since = new Date()
  since.setDate(since.getDate() - 60)

  const { data: attData, error: attErr } = await db
    .from('attendance')
    .select('rider_id, date, status, present, rider_name')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  if (attErr) return NextResponse.json({ ok: false, error: attErr.message }, { status: 500 })

  const byRider = new Map<string, Att[]>()
  for (const a of (attData ?? []) as Att[]) {
    const list = byRider.get(a.rider_id) ?? []
    list.push(a)
    byRider.set(a.rider_id, list)
  }

  // מי החסיר לפחות פעמיים ברצף
  const flagged: { rider_id: string; lastDate: string; streak: number; dates: string[] }[] = []
  for (const [rider_id, list] of byRider) {
    const dates: string[] = []
    for (const a of list) { if (isPresent(a)) break; dates.push(a.date) }
    if (dates.length >= 2) flagged.push({ rider_id, lastDate: dates[0], streak: dates.length, dates })
  }

  if (flagged.length === 0) return NextResponse.json({ ok: true, flagged: 0, sent: 0 })

  // סינון מי שכבר דיווחנו עליו לאותו תאריך
  const { data: already } = await db
    .from('absence_alerts')
    .select('rider_id, last_absence_date')
    .in('rider_id', flagged.map(f => f.rider_id))

  const seen = new Set((already ?? []).map(a => `${a.rider_id}|${a.last_absence_date}`))
  const fresh = flagged.filter(f => !seen.has(`${f.rider_id}|${f.lastDate}`))

  if (fresh.length === 0) return NextResponse.json({ ok: true, flagged: flagged.length, sent: 0 })

  const { data: ridersData } = await db
    .from('riders')
    .select('id, full_name, phone, parent_phone, group_name, branch')
    .in('id', fresh.map(f => f.rider_id))

  const riderById = new Map(((ridersData ?? []) as Rider[]).map(r => [r.id, r]))

  const rows = fresh.map(f => {
    const r = riderById.get(f.rider_id)
    const name = r?.full_name ?? byRider.get(f.rider_id)?.[0]?.rider_name ?? 'ללא שם'
    const phone = r?.parent_phone || r?.phone || ''
    const wa = phone
      ? `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(`היי, זה בני מטבע בייק. שמנו לב ש${name} לא הגיע/ה לאימונים האחרונים — הכל בסדר?`)}`
      : ''
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee"><b>${name}</b></td>
      <td style="padding:8px;border-bottom:1px solid #eee">${r?.group_name ?? '—'}${r?.branch ? ` · ${r.branch}` : ''}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${f.streak}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${f.dates.map(fmt).join(', ')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${wa ? `<a href="${wa}">וואטסאפ</a>` : '—'}</td>
    </tr>`
  }).join('')

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: RECIPIENTS,
        subject: `${fresh.length} חניכים החסירו פעמיים ברצף`,
        html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
          <h2 style="margin:0 0 6px">התראת היעדרויות</h2>
          <p style="color:#555;margin:0 0 16px">החניכים הבאים לא הגיעו לשני אימונים אחרונים או יותר.</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr style="background:#f4f4f2">
              <th style="padding:8px;text-align:right">חניך</th>
              <th style="padding:8px;text-align:right">קבוצה</th>
              <th style="padding:8px;text-align:right">רצף</th>
              <th style="padding:8px;text-align:right">תאריכים</th>
              <th style="padding:8px;text-align:right">קשר</th>
            </tr>
            ${rows}
          </table>
          <p style="margin-top:18px;font-size:13px">
            <a href="https://www.tevabike.com/admin/coordinator/reports">לכרטיסי החניכים</a>
          </p>
        </div>`,
      }),
    }).catch(err => console.error('[absence-alerts] resend error:', err))
  } else {
    console.error('[absence-alerts] RESEND_API_KEY missing')
  }

  await db.from('absence_alerts').insert(
    fresh.map(f => ({
      rider_id: f.rider_id,
      rider_name: riderById.get(f.rider_id)?.full_name ?? null,
      last_absence_date: f.lastDate,
    })),
  )

  return NextResponse.json({ ok: true, flagged: flagged.length, sent: fresh.length })
}
