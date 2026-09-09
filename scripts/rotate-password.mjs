#!/usr/bin/env node
/**
 * TevaBike — rotate one user's login password
 *
 * Usage:  node scripts/rotate-password.mjs someone@example.com
 * Needs:  NEXT_PUBLIC_SUPABASE_URL       (in .env.local)
 *         SUPABASE_SERVICE_ROLE_KEY      (in .env.local — never leaves this machine)
 *
 * Generates one fresh random password and sets it directly via the Supabase
 * Admin API — no email, no link, nothing for the employee to click. Their
 * current session (if any) keeps working until it expires or they log out;
 * only their *next* login needs the new password, which you give them
 * yourself (WhatsApp/phone call — never in a plaintext email or chat log).
 *
 * Run once per account that needs rotating, e.g. after a leaked-credential
 * incident:
 *   node scripts/rotate-password.mjs bennyfire@gmail.com
 *   node scripts/rotate-password.mjs mor@tevabike.com
 *   node scripts/rotate-password.mjs erez@tevabike.com
 *   node scripts/rotate-password.mjs omri@tevabike.com
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname }        from 'node:path'
import { fileURLToPath }           from 'node:url'
import { randomBytes }             from 'node:crypto'
import { createClient }            from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv(resolve(ROOT, '.env.local'))
loadEnv(resolve(ROOT, '.env'))

const email = process.argv[2]
if (!email) {
  console.error('\n❌  Usage: node scripts/rotate-password.mjs someone@example.com\n')
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env.local\n')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function randomPassword() {
  return randomBytes(12).toString('base64url') // 16 chars, ~96 bits
}

console.log(`\n🔎  Looking up ${email}…`)

let page = 1
let found = null
while (!found) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error(`\n❌  ${error.message}\n`)
    process.exit(1)
  }
  found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found || data.users.length < 200) break
  page++
}

if (!found) {
  console.error(`\n❌  No user found with email ${email}\n`)
  process.exit(1)
}

const newPassword = randomPassword()
const { error: updErr } = await admin.auth.admin.updateUserById(found.id, { password: newPassword })
if (updErr) {
  console.error(`\n❌  Failed to update password: ${updErr.message}\n`)
  process.exit(1)
}

console.log(`
✅  Password rotated.

   Email    : ${email}
   Password : ${newPassword}

Give this to them directly (WhatsApp/phone) — never over email or a shared
doc. Their current login session (if any) keeps working until it expires or
they log out; only the next fresh login needs this password.
`)
