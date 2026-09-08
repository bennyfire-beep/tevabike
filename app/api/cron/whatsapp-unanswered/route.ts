// app/api/cron/whatsapp-unanswered/route.ts — רשת ביטחון יומית, בנוסף
// להתראה המיידית (push + מייל + תבנית) שכבר יוצאת ב-lib/whatsapp-notify.ts
// ברגע שהודעה נכנסת. אם משהו התפספס בכל זאת (לא ראית פוש, לא שמת לב
// למייל) — דוח יומי אחד שמרכז כל שיחה שעדיין פתוחה (חלון 24 שעות) בלי
// שהצוות ענה על ההודעה האחרונה של הלקוח.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, BENNY_EMAIL } from '@/lib/shop-order-email'
import { isReplyWindowOpen } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const isCron = req.headers.get('x-vercel-cron') !== null
  const secret = req.nextUrl.searchParams.get('secret')
  if (!isCron && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // כל שיחה שעדיין בתוך חלון 24 השעות — מועמדת. בודקים לכל אחת בנפרד אם
  // ההודעה האחרונה שלה היא נכנסת (=טרם נענתה) — אותה לוגיקה בדיוק שהמסך
  // עצמו משתמש בה (pendingInboundId ב-admin/coordinator/whatsapp/page.tsx).
  const { data: conversations } = await admin
    .from('whatsapp_conversations')
    .select('id, wa_id, display_name, last_inbound_at')
    .not('last_inbound_at', 'is', null)

  const open = (conversations ?? []).filter((c: any) => isReplyWindowOpen(c.last_inbound_at))

  const unanswered: { name: string; phone: string; preview: string; conversationId: string }[] = []
  for (const c of open as any[]) {
    const { data: lastMsg } = await admin
      .from('whatsapp_messages')
      .select('direction, body')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastMsg?.direction === 'inbound') {
      unanswered.push({
        name: c.display_name || c.wa_id,
        phone: c.wa_id,
        preview: (lastMsg.body || '').slice(0, 100),
        conversationId: c.id,
      })
    }
  }

  if (unanswered.length === 0) {
    return NextResponse.json({ ok: true, open: 0 })
  }

  const rows = unanswered
    .map(
      (u) =>
        `• <a href="https://www.tevabike.com/admin/coordinator/whatsapp?conversation=${u.conversationId}">${u.name} (${u.phone})</a> — ${u.preview}`
    )
    .join('<br>')

  await sendEmail(
    BENNY_EMAIL,
    undefined,
    `💬 ${unanswered.length} שיחות וואטסאפ פתוחות בלי מענה`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;padding:20px">
      <h2 style="margin:0 0 12px;color:#25D366">שיחות וואטסאפ שממתינות לתשובה</h2>
      <p style="color:#555;font-size:13px;margin:0 0 16px">
        זו רשת ביטחון יומית — התראה מיידית כבר יוצאת ברגע שהודעה נכנסת. אלה שיחות שעדיין פתוחות
        (בתוך 24 שעות) בלי שההודעה האחרונה של הלקוח נענתה.
      </p>
      <div style="font-size:14px;line-height:1.8">${rows}</div>
    </div>`
  )

  return NextResponse.json({ ok: true, open: unanswered.length })
}
