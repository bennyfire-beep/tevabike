import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { WHATSAPP_GRAPH_VERSION, normalizeToWaId } from '@/lib/whatsapp'

// רץ פעם ביום דרך Vercel Cron (מוגדר ב-vercel.json).
// מוצא אנשי צוות שיום ההולדת שלהם (יום+חודש) חל בעוד 7 ימים בדיוק, ושולח
// לבני/טל/שיר תזכורת במייל — וגם ל-WhatsApp של בני, ברגע שיוגדרו
// BIRTHDAY_WHATSAPP_TO ו-BIRTHDAY_TEMPLATE_NAME (ר' .env.example).
// כל יום הולדת מדווח פעם אחת בלבד ליום שבו הריצה תפסה אותו
// (unique על staff_birthday_id + notify_date בטבלת staff_birthday_alerts).

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RECIPIENTS = ['bennyfire@gmail.com', 'talmatoki@gmail.com', 'shirkobi8@gmail.com']
const FROM = 'טבע בייק <info@mail.tevabike.com>'
const LEAD_DAYS = 7

type StaffBirthday = {
  id: string
  full_name: string
  birth_day: number
  birth_month: number
  birth_year: number | null
}

const heDate = (d: Date) => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(today)
  target.setDate(target.getDate() + LEAD_DAYS)
  const targetDay = target.getDate()
  const targetMonth = target.getMonth() + 1
  const todayIso = today.toISOString().slice(0, 10)

  const { data: matches, error } = await db
    .from('staff_birthdays')
    .select('id, full_name, birth_day, birth_month, birth_year')
    .eq('active', true)
    .eq('birth_day', targetDay)
    .eq('birth_month', targetMonth)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!matches || matches.length === 0) return NextResponse.json({ ok: true, matched: 0, sent: 0 })

  // מי כבר דווח היום (למקרה שהריצה קרתה פעמיים)
  const { data: already } = await db
    .from('staff_birthday_alerts')
    .select('staff_birthday_id')
    .eq('notify_date', todayIso)
    .in('staff_birthday_id', matches.map((m) => m.id))
  const done = new Set((already ?? []).map((a) => a.staff_birthday_id))
  const fresh = (matches as StaffBirthday[]).filter((m) => !done.has(m.id))

  if (fresh.length === 0) return NextResponse.json({ ok: true, matched: matches.length, sent: 0 })

  const dateLabel = heDate(target)

  const rows = fresh
    .map(
      (p) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee"><b>${p.full_name}</b></td>
      <td style="padding:8px;border-bottom:1px solid #eee">${dateLabel}</td>
    </tr>`,
    )
    .join('')

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: RECIPIENTS,
        subject:
          fresh.length === 1
            ? `🎂 יום ההולדת של ${fresh[0].full_name} בעוד שבוע`
            : `🎂 ${fresh.length} ימי הולדת בעוד שבוע`,
        html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif">
          <h2 style="margin:0 0 6px">🎂 תזכורת ימי הולדת</h2>
          <p style="color:#555;margin:0 0 16px">זמן לדאוג למתנה! 🎁</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px">
            <tr style="background:#f4f4f2">
              <th style="padding:8px;text-align:right">שם</th>
              <th style="padding:8px;text-align:right">תאריך</th>
            </tr>
            ${rows}
          </table>
          <p style="margin-top:18px;font-size:13px;color:#888">— טבע בייק</p>
        </div>`,
      }),
    }).catch((err) => console.error('[staff-birthdays] resend error:', err))
  } else {
    console.error('[staff-birthdays] RESEND_API_KEY missing')
  }

  await sendWhatsappAlerts(fresh, dateLabel)

  await db.from('staff_birthday_alerts').insert(fresh.map((p) => ({ staff_birthday_id: p.id, notify_date: todayIso })))

  return NextResponse.json({ ok: true, matched: matches.length, sent: fresh.length })
}

// ── WhatsApp to Benny (phase 2) ─────────────────────────────────────────────
// Not live yet: needs BIRTHDAY_WHATSAPP_TO (Benny's number) and
// BIRTHDAY_TEMPLATE_NAME (an approved Meta template with two body params —
// {{1}} = name, {{2}} = date), see .env.example. Reuses WHATSAPP_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID, the same Meta Cloud API credentials the live
// WhatsApp CRM already needs (app/api/whatsapp/send). Silently no-ops until
// all four are set — same stance as the template-alert stub in
// lib/whatsapp-notify.ts.
async function sendWhatsappAlerts(people: StaffBirthday[], dateLabel: string) {
  const templateName = process.env.BIRTHDAY_TEMPLATE_NAME
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const to = process.env.BIRTHDAY_WHATSAPP_TO
  if (!templateName || !token || !phoneNumberId || !to) return

  const waId = normalizeToWaId(to)
  await Promise.all(
    people.map(async (p) => {
      try {
        const res = await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: waId,
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'he' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: p.full_name },
                    { type: 'text', text: dateLabel },
                  ],
                },
              ],
            },
          }),
        })
        if (!res.ok) {
          console.error('[staff-birthdays] whatsapp send failed for', p.full_name, await res.text().catch(() => ''))
        }
      } catch (e) {
        console.error('[staff-birthdays] whatsapp send error for', p.full_name, (e as Error).message)
      }
    }),
  )
}
