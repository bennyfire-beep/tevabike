#!/usr/bin/env node
/**
 * TevaBike — admin user seed script
 * Usage:  node scripts/seed.mjs
 * Needs:  NEXT_PUBLIC_SUPABASE_URL  (required)
 *         SUPABASE_SERVICE_ROLE_KEY (preferred — creates users silently)
 *         NEXT_PUBLIC_SUPABASE_ANON_KEY (fallback — uses auth.signUp)
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname }        from 'node:path'
import { fileURLToPath }           from 'node:url'
import { createClient }            from '@supabase/supabase-js'

// ─── Load .env.local ──────────────────────────────────────────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq  = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let   val = line.slice(eq + 1).trim()
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv(resolve(ROOT, '.env.local'))
loadEnv(resolve(ROOT, '.env'))

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY   // preferred
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  console.error('\n❌  NEXT_PUBLIC_SUPABASE_URL not set in .env.local\n')
  process.exit(1)
}
if (!SERVICE_KEY && !ANON_KEY) {
  console.error('\n❌  Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY found\n')
  process.exit(1)
}

const useAdminApi = Boolean(SERVICE_KEY)
if (!useAdminApi) {
  console.warn('\n⚠️   SUPABASE_SERVICE_ROLE_KEY not found — falling back to auth.signUp()')
  console.warn('    If email confirmation is ON, users must confirm before logging in.')
  console.warn('    Add SUPABASE_SERVICE_ROLE_KEY to .env.local for silent creation.\n')
}

// ─── Clients ──────────────────────────────────────────────────────────────────
// Admin client (service role — bypasses RLS, can create auth users)
const admin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

// Anon client (for signUp fallback)
const anon = createClient(SUPABASE_URL, ANON_KEY ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Use service-role client for DB writes when available (bypasses RLS)
const db = admin ?? anon

// ─── Seed data ────────────────────────────────────────────────────────────────
// Note: 'admin' is mapped to 'coordinator' — coordinator has full read access
// and is the only role that can edit instructor hourly rates in the salary page.
const USERS = [
  {
    email:       'bennyfire@gmail.com',
    password:    'Tevabike2024!',
    name:        'בני להט',
    role:        'coordinator',   // coordinator = admin / owner
    branch:      null,
    hourly_rate: null,
    label:       'מנהל ראשי',
  },
  {
    email:       'mor@tevabike.com',
    password:    'Mor2024!',
    name:        'מור בזק',
    role:        'instructor',
    branch:      'משגב',
    hourly_rate: 80,
    label:       'מדריכה — משגב',
  },
  {
    email:       'erez@tevabike.com',
    password:    'Erez2024!',
    name:        'ארז ברזון',
    role:        'instructor',
    branch:      'מצובה',
    hourly_rate: 90,
    label:       'מדריך — מצובה',
  },
  {
    email:       'omri@tevabike.com',
    password:    'Omri2024!',
    name:        'עמרי זילברשטיין',
    role:        'instructor',
    branch:      'ביריה',
    hourly_rate: 85,
    label:       'מדריך — ביריה',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function resolveUserId(email, password) {
  if (useAdminApi) {
    // Try to create (admin API — no email confirmation needed)
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (!error) return { id: data.user.id, created: true }

    // User already exists → paginate listUsers to find them
    if (/already|exists/i.test(error.message)) {
      let page = 1
      while (true) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 50 })
        if (!list?.users?.length) break
        const found = list.users.find(u => u.email === email)
        if (found) {
          await admin.auth.admin.updateUserById(found.id, { password })
          return { id: found.id, created: false }
        }
        if (list.users.length < 50) break
        page++
      }
      return { id: null, error: 'User exists but could not be located in Auth table' }
    }
    return { id: null, error: error.message }
  }

  // ── Fallback: anon signUp ────────────────────────────────────────────────
  // Note: Supabase free tier has strict email rate limits.
  // Add SUPABASE_SERVICE_ROLE_KEY to .env.local for reliable seeding.
  const { data, error } = await anon.auth.signUp({ email, password })
  if (!error && data?.user?.id) return { id: data.user.id, created: true }

  // Some Supabase plans return identities:[] instead of an error when user exists
  if (data?.user?.identities?.length === 0) {
    // Try sign-in to retrieve their ID
    const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email, password })
    if (!siErr && si?.user?.id) { await anon.auth.signOut(); return { id: si.user.id, created: false } }
    return { id: null, error: 'User exists — sign-in failed (wrong password or email unconfirmed)' }
  }

  const msg = error?.message ?? error?.status ?? JSON.stringify(error) ?? 'unknown error'
  if (/already|registered|exists/i.test(msg)) {
    const { data: si, error: siErr } = await anon.auth.signInWithPassword({ email, password })
    if (!siErr && si?.user?.id) { await anon.auth.signOut(); return { id: si.user.id, created: false } }
  }
  return { id: null, error: msg }
}

// ─── Run ──────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60))
console.log('  🌱  TevaBike — seeding admin users')
console.log('  ' + SUPABASE_URL)
console.log('═'.repeat(60) + '\n')

const results = []

for (const u of USERS) {
  process.stdout.write(`  ${u.name.padEnd(22)} `)

  const { id: userId, created, error: resolveErr } = await resolveUserId(u.email, u.password)
  if (!userId) {
    console.log(`❌  ${resolveErr}`)
    results.push({ ...u, status: 'error', error: resolveErr })
    continue
  }

  // Upsert admin_roles row
  const { error: roleErr } = await db.from('admin_roles').upsert(
    { user_id: userId, role: u.role, name: u.name, branch: u.branch, hourly_rate: u.hourly_rate },
    { onConflict: 'user_id' },
  )

  if (roleErr) {
    console.log(`❌  admin_roles: ${roleErr.message}`)
    results.push({ ...u, status: 'error', error: roleErr.message })
  } else {
    console.log(`✅  ${created ? 'created' : 'updated'}`)
    results.push({ ...u, status: 'ok' })
  }
}

// ─── Print credentials (always — even on failure) ────────────────────────────
const ok     = results.filter(r => r.status === 'ok')
const failed = results.filter(r => r.status !== 'ok')
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]

console.log('\n' + '═'.repeat(62))
console.log('  🔐  ALL LOGIN CREDENTIALS')
console.log('═'.repeat(62))

for (const r of USERS) {
  const res    = results.find(x => x.email === r.email)
  const status = res?.status === 'ok' ? '✅' : '⚠️ '
  const rate   = r.hourly_rate ? `  ·  ₪${r.hourly_rate}/שעה` : ''
  const path   = r.role === 'coordinator' ? 'coordinator' : 'instructor'
  console.log(`
  ${status} ${r.name} (${r.label})
     Email    : ${r.email}
     Password : ${r.password}
     Role     : ${r.role}${rate}
     Login at : /admin/login  →  /admin/${path}`)
}

console.log('\n' + '─'.repeat(62))

if (failed.length > 0) {
  console.log('\n  ⚠️   Some users were NOT created automatically:')
  for (const f of failed) console.log(`  ✗  ${f.email}:  ${f.error}`)

  console.log(`
  ─────────────────────────────────────────────────────────
  HOW TO FIX — option A (recommended):
    1. Get your service role key from:
       https://supabase.com/dashboard/project/${projectRef}/settings/api
       (Section: "Project API keys" → "service_role")
    2. Add to .env.local:
       SUPABASE_SERVICE_ROLE_KEY=<paste here>
    3. Run again:  node scripts/seed.mjs

  HOW TO FIX — option B (manual):
    Open: https://supabase.com/dashboard/project/${projectRef}/auth/users
    Create each user above with "New user" → "Create new user"
    Then open the SQL Editor and run:
      insert into admin_roles (user_id, role, name, branch, hourly_rate)
      values
        ('<bennyfire-uid>',  'coordinator', 'בני להט',           null,     null),
        ('<mor-uid>',        'instructor',  'מור בזק',           'משגב',   80),
        ('<erez-uid>',       'instructor',  'ארז ברזון',         'מצובה',  90),
        ('<omri-uid>',       'instructor',  'עמרי זילברשטיין',   'ביריה',  85);
  ─────────────────────────────────────────────────────────`)
} else {
  console.log(`\n  ✅  All ${ok.length} users seeded successfully!`)
  console.log(`  📄  Manage users: https://supabase.com/dashboard/project/${projectRef}/auth/users`)
}

console.log('\n  ⚠️   Change passwords after first login.')
console.log('═'.repeat(62) + '\n')
