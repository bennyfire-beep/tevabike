// app/api/webhooks/resend-inbound/route.ts — קליטה אוטומטית של תשובות
// פאן רייד. ה-reply-to על מייל ההזמנה לספק (notify-supplier) מוגדר ל-
// SUPPLIER_REPLY_TO (updates@mail.tevabike.com, על דומיין עם receiving
// מופעל ב-Resend) — כשהם עונים, Resend שולח לכאן webhook מסוג email.received.
//
// מה קורה כאן:
//  1. מוודאים חתימת Svix (RESEND_WEBHOOK_SECRET) — לא מעבדים מייל לא חתום.
//  2. מחפשים בגוף התשובה את "מס' הזמנה: XXXXXXXX" שפאן רייד מצטטים
//     בחזרה מכרטיס ההזמנה המקורי — זה 8 התווים הראשונים של shop_orders.id.
//  3. מנחשים סטטוס/מספר חבילה ממילות מפתח בטקסט שלפני הציטוט. זו רק
//     הצעה: לא נשלח לבד ללקוח כלום, ולא נדרס מה שבני כבר סימן ידנית.
//  4. תמיד מעבירים לבני את התשובה המקורית + מה שזוהה, כדי שדבר לא "יאבד"
//     גם אם הפענוח נכשל או ההזמנה לא נמצאה.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { BENNY_EMAIL, sendEmail } from '@/lib/shop-order-email'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function verifySvix(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const sigHeader = headers.get('svix-signature')
  if (!id || !timestamp || !sigHeader) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${id}.${timestamp}.${body}`
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')

  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1]
    if (!sig) return false
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    } catch {
      return false // אורך שונה — לא תואם, לא שגיאה
    }
  })
}

// שורות הטקסט של פאן רייד עצמם מגיעות לפני הסימון "בתאריך ... כתב:"
// שה-mail client שלהם מוסיף לפני הציטוט של המייל המקורי.
function replyOnly(text: string): string {
  const idx = text.search(/בתאריך .+ (כתב|wrote):/)
  return (idx > 0 ? text.slice(0, idx) : text).trim()
}

function parseReply(fullText: string) {
  const reply = replyOnly(fullText)
  const orderIdMatch = fullText.match(/מס['׳]? הזמנה:\s*([a-f0-9]{8})/i)
  const trackingMatch = reply.match(/מספר\s*חבילה\s*:?\s*(\d{4,})/)
  const priceMatch = reply.match(/(?:מחיר סופי|עלות סופית|לגבייה)\s*:?\s*(\d{2,})/)

  let status: string | null = null
  if (/בוטל|לא ניתן לספק|אין\s*יותר\s*במלאי/.test(reply)) status = 'cancelled'
  else if (/עיכוב|יתעכב|אזל\s*זמנית|חוסר\s*זמני/.test(reply)) status = 'delayed'
  else if (/נשלח/.test(reply)) status = 'shipped'

  return {
    orderIdPrefix: orderIdMatch?.[1]?.toLowerCase() ?? null,
    trackingNumber: trackingMatch?.[1] ?? null,
    finalPrice: priceMatch ? Number(priceMatch[1]) : null,
    status,
    reply,
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const rawBody = await req.text()

  if (!secret || !verifySvix(rawBody, req.headers, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  if (payload?.type !== 'email.received') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const data = payload.data ?? {}
  const text: string = data.text || data.html || ''
  const from: string = data.from || 'לא ידוע'
  const subject: string = data.subject || '(ללא נושא)'

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const parsed = parseReply(text)
  let matchedGroup: string | null = null
  let matchedCustomer: string | null = null

  if (parsed.orderIdPrefix) {
    const { data: candidates } = await admin
      .from('shop_orders')
      .select('id, order_group, customer_name, total_amount, supplier_status')
      .eq('supplier_notified', true)
    const match = (candidates ?? []).find((r: any) => (r.id as string).startsWith(parsed.orderIdPrefix!))
    if (match) {
      matchedGroup = (match as any).order_group
      matchedCustomer = (match as any).customer_name
      const ids = matchedGroup
        ? (candidates ?? []).filter((r: any) => r.order_group === matchedGroup).map((r: any) => r.id)
        : [(match as any).id]
      const updates: Record<string, unknown> = { supplier_reply_raw: parsed.reply.slice(0, 1000) }
      if (parsed.status) updates.supplier_status = parsed.status
      if (parsed.trackingNumber) updates.tracking_number = parsed.trackingNumber
      if (parsed.finalPrice) updates.final_price = parsed.finalPrice
      await admin.from('shop_orders').update(updates).in('id', ids)
    }
  }

  // תמיד מעבירים לבני את התשובה המקורית — גם אם לא זוהתה הזמנה, כדי
  // שדבר לא ילך לאיבוד. הוא ממשיך לאשר/לשלוח עדכון ללקוח ידנית מהמסך.
  const statusLabel: Record<string, string> = { shipped: 'נשלח', delayed: 'עיכוב', cancelled: 'בוטל' }
  await sendEmail(
    BENNY_EMAIL,
    undefined,
    `תשובה מפאן רייד${matchedCustomer ? ` — ${matchedCustomer}` : ''}`,
    `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;padding:20px">
      <p style="margin:0 0 8px"><b>מאת:</b> ${from}</p>
      <p style="margin:0 0 8px"><b>נושא:</b> ${subject}</p>
      <p style="margin:0 0 16px;color:#555">
        ${matchedGroup
          ? `זוהתה הזמנה תואמת (${matchedCustomer}).${parsed.status ? ` סטטוס שזוהה אוטומטית: <b>${statusLabel[parsed.status] ?? parsed.status}</b>.` : ' לא זוהה סטטוס ברור — תבדוק ותסמן ידנית.'}${parsed.trackingNumber ? ` מספר חבילה: ${parsed.trackingNumber}.` : ''} תעדכן/תאשר במסך "הזמנות חנות".`
          : 'לא זוהתה הזמנה תואמת אוטומטית — תבדוק ותעדכן ידנית.'}
      </p>
      <pre style="white-space:pre-wrap;font-family:Heebo,Arial,sans-serif;font-size:13px;background:#f5f5f5;padding:12px;border-radius:8px">${parsed.reply || text}</pre>
    </div>`
  )

  return NextResponse.json({ ok: true, matched: Boolean(matchedGroup) })
}
