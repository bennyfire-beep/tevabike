import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { primaryRow } from '@/lib/roles'

// v1 — ליד שנפתח על ידי צוות (מדריך או רכזת) מתוך טופס "חניך חדש".
//
// כשמדריך מזין חניך חדש במסך הנוכחות (או רכזת בעמוד תלמידים), החניך נשמר
// בטבלת riders עם payment_status='unpaid', והמסלול הזה פותח לו במקביל שורה
// ב"מתעניינים" (leads) כדי שהתהליך ימשיך, ושולח מייל לטל.
//
// הכתיבה ל-leads נעשית עם ה-service role — אבל רק אחרי שאימתנו שהקורא הוא
// באמת איש צוות מחובר (admin_roles). זה לא מסלול ציבורי.

export const dynamic = 'force-dynamic'

const LEAD_TO = 'talmatoki@gmail.com'          // טל ברקן
const LEAD_INTEREST = 'חוג רכיבה — ילדים או מבוגרים'  // חייב להיות ערך חוקי מ-LEAD_INTERESTS

const MAX_NAME = 100
const MAX_PHONE = 30
const MAX_TEXT = 500

const cut = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** שליחת המייל לטל. best-effort — הליד כבר נשמר בכל מקרה. */
async function notifyTal(v: {
  riderName: string; parentName: string; parentPhone: string; riderPhone: string
  branch: string | null; groupName: string | null; notes: string | null; addedBy: string
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return

  const rows = [
    ['שם החניך', v.riderName],
    ['טלפון החניך', v.riderPhone || '—'],
    ['שם ההורה', v.parentName || '—'],
    ['טלפון ההורה', v.parentPhone],
    ['קבוצה', v.groupName ?? '—'],
    ['סניף', v.branch ?? '—'],
    ['הערות', v.notes ?? '—'],
    ['הוזן על ידי', v.addedBy],
  ]
    .map(([k, val]) => `<tr><td style="padding:6px 12px;font-weight:700">${esc(k)}</td><td style="padding:6px 12px">${esc(val)}</td></tr>`)
    .join('')

  const wa = (v.riderPhone || v.parentPhone).replace(/\D/g, '').replace(/^0/, '972')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: [LEAD_TO],
        reply_to: 'bennyfire@gmail.com',
        subject: `חניך חדש מהשטח — ${v.riderName}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚵 חניך חדש הוזן על ידי הצוות</h2>
          <p style="margin:0 0 12px">החניך נוסף למערכת כ<b>לא שולם</b> ונפתח לו ליד ב"מתעניינים" להמשך התהליך.</p>
          <table style="border-collapse:collapse;font-size:15px">${rows}</table>
          <p style="margin-top:16px">
            <a href="https://wa.me/${wa}"
               style="background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              פתיחת וואטסאפ
            </a>
            &nbsp;
            <a href="https://www.tevabike.com/admin/coordinator/leads"
               style="background:#b5e853;color:#0d0f0e;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              מסך מתעניינים
            </a>
          </p>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[staff-lead] email failed (lead was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[staff-lead] SUPABASE_SERVICE_ROLE_KEY or URL not set')
    return NextResponse.json({ ok: false, error: 'השרת לא מוגדר נכון' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. הקורא חייב להיות איש צוות מחובר ──
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'לא מחובר' }, { status: 401 })

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user)
    return NextResponse.json({ ok: false, error: 'ההזדהות נכשלה, התחבר מחדש' }, { status: 401 })

  // כל השורות. admin_roles היא שורה אחת לכל תפקיד, ויש מי שמחזיק כמה —
  // .limit(1) החזירה שורה שרירותית, כלומר גם השם ב"הוזן על ידי" היה מקרי.
  // primaryRow בוחר לפי עדיפות קבועה, ולכן אותו אדם יופיע תמיד אותו דבר.
  const { data: roleRows } = await admin
    .from('admin_roles')
    .select('role, name')
    .eq('user_id', caller.user.id)

  const roleRow = primaryRow(roleRows)
  if (!roleRow)
    return NextResponse.json({ ok: false, error: 'אין לך הרשאה' }, { status: 403 })

  // ── 2. קריאת הנתונים ──
  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 }) }

  const riderName   = cut(body.rider_name, MAX_NAME)
  const parentName  = cut(body.parent_name, MAX_NAME)
  const parentPhone = cut(body.parent_phone, MAX_PHONE)
  const riderPhone  = cut(body.rider_phone, MAX_PHONE)
  const branch      = cut(body.branch, 60) || null
  const groupName   = cut(body.group_name, 80) || null
  const notes       = cut(body.notes, MAX_TEXT) || null
  const addedBy     = roleRow.name || caller.user.email || 'צוות'

  if (!riderName || !(riderPhone || parentPhone))
    return NextResponse.json({ ok: false, error: 'חסר שם או טלפון' }, { status: 400 })

  // מספר הקשר של הליד: קודם כל טלפון החניך, ואם אין — של ההורה.
  const phone = riderPhone || parentPhone

  const message = [
    `חניך חדש שהוזן על ידי ${addedBy} במערכת.`,
    parentName ? `הורה: ${parentName}` : null,
    parentPhone ? `טלפון הורה: ${parentPhone}` : null,
    riderPhone ? `טלפון חניך: ${riderPhone}` : null,
    groupName ? `קבוצה: ${groupName}` : null,
    notes ? `הערות: ${notes}` : null,
    'החניך נוסף לרשימת התלמידים בסטטוס "לא שולם".',
  ].filter(Boolean).join('\n')

  const { error } = await admin.from('leads').insert({
    full_name: riderName,
    phone,
    interest: LEAD_INTEREST,
    message,
    branch,
    source: 'staff',
    // status ברירת מחדל 'new' — הליד יופיע ראשון במסך מתעניינים
  })

  if (error) {
    console.error('[staff-lead] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await notifyTal({ riderName, parentName, parentPhone, riderPhone, branch, groupName, notes, addedBy })

  return NextResponse.json({ ok: true })
}
