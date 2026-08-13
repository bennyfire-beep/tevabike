import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LEAD_INTERESTS, LEAD_BRANCHES } from '@/lib/leads'

// Public leads intake.
//
// The public contact form posts here and we insert with the SERVICE ROLE, so
// the anon key never touches the leads table directly and no admin data is ever
// exposed to anon. RLS still allows anon INSERT as defence-in-depth, but reads
// require authentication. We require the service role and fail loudly if it's
// missing (rather than silently degrading).
//
// Campaign tracking: the form forwards utm_source / utm_medium / utm_campaign
// from the landing URL so paid leads can be told apart from organic ones.
// `source` is the coarse channel used for grouping in the coordinator view.

export const dynamic = 'force-dynamic'

// This endpoint is public and unauthenticated, so cap every free-text field.
const MAX_NAME = 100
const MAX_PHONE = 30
const MAX_MESSAGE = 1000
const MAX_UTM = 120

/** Trim, cap length, and return null for empty — used for optional fields. */
function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s.length ? s : null
}

/** Fire-and-forget email alert. Never blocks or fails the lead insert. */
async function notify(lead: {
  full_name: string
  phone: string
  interest: string
  branch: string | null
  message: string | null
  source: string
  utm_campaign: string | null
}) {
  const key = process.env.RESEND_API_KEY
  if (!key) return // not configured — skip silently

  const rows = [
    ['שם', lead.full_name],
    ['טלפון', lead.phone],
    ['תחום עניין', lead.interest],
    ['סניף', lead.branch ?? '—'],
    ['מקור', lead.source],
    ['קמפיין', lead.utm_campaign ?? '—'],
    ['הודעה', lead.message ?? '—'],
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:700">${k}</td><td style="padding:6px 12px">${v}</td></tr>`)
    .join('')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Teva Bike <leads@mail.tevabike.com>',
        to: ['bennyfire@gmail.com'],
        subject: `ליד חדש — ${lead.full_name} (${lead.source})`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif">
          <h2 style="margin:0 0 12px">🚵 ליד חדש מהאתר</h2>
          <table style="border-collapse:collapse;font-size:15px">${rows}</table>
          <p style="margin-top:16px">
            <a href="https://wa.me/972${lead.phone.replace(/\D/g, '').replace(/^0/, '')}"
               style="background:#25D366;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">
              פתיחת וואטסאפ
            </a>
          </p>
        </div>`,
      }),
    })
  } catch (e) {
    console.error('[leads] notification failed (lead was still saved):', e)
  }
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('[leads] SUPABASE_SERVICE_ROLE_KEY or URL not set — cannot save lead. Configure it in the deployment environment.')
    return NextResponse.json({ ok: false, error: 'Server misconfigured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const full_name = (typeof body.full_name === 'string' ? body.full_name : '').trim().slice(0, MAX_NAME)
  const phone     = (typeof body.phone === 'string' ? body.phone : '').trim().slice(0, MAX_PHONE)
  const interest  = (typeof body.interest === 'string' ? body.interest : '').trim()
  const message   = clean(body.message, MAX_MESSAGE)

  if (!full_name || !phone || !interest) {
    return NextResponse.json({ ok: false, error: 'חסרים שדות חובה' }, { status: 400 })
  }
  if (!(LEAD_INTERESTS as readonly string[]).includes(interest)) {
    return NextResponse.json({ ok: false, error: 'תחום עניין לא תקין' }, { status: 400 })
  }

  // Optional — silently dropped if it isn't one of ours, rather than rejecting
  // the whole lead over a tracking field.
  const rawBranch = clean(body.branch, 60)
  const branch = rawBranch && (LEAD_BRANCHES as readonly string[]).includes(rawBranch) ? rawBranch : null

  const utm_source   = clean(body.utm_source, MAX_UTM)
  const utm_medium   = clean(body.utm_medium, MAX_UTM)
  const utm_campaign = clean(body.utm_campaign, MAX_UTM)

  // Coarse channel: the ad platform's utm_source when present, else organic.
  const source = (utm_source ?? 'website').toLowerCase()

  const db = createClient(url, serviceKey)
  const { error } = await db.from('leads').insert({
    full_name,
    phone,
    interest,
    message,
    branch,
    source,
    utm_source,
    utm_medium,
    utm_campaign,
    // status defaults to 'new' in the DB
  })

  if (error) {
    console.error('[leads] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Alert is best-effort — the lead is already safely stored either way.
  await notify({ full_name, phone, interest, branch, message, source, utm_campaign })

  return NextResponse.json({ ok: true })
}
