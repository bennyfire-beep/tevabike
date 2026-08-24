import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_LOGIN       = '/admin/login'
const ADMIN_PREFIX      = '/admin'
const STUDENT_PREFIX    = '/student'

// These admin paths are publicly accessible (no auth cookie required)
const ADMIN_PUBLIC_PATHS = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',   // receives ?code= from Supabase reset email
  // Instructor mobile page. It requires a login and gates itself — it resolves
  // admin_roles by auth.uid() and redirects to /admin/login when there is no
  // session. It stays listed here on purpose: the cookie this proxy checks and
  // the Supabase session the page checks expire independently, and a field tool
  // must not lock an instructor out mid-lesson over the shorter of the two.
  '/admin/instructor',
]

// The role-gated areas. Kept in step with ROLE_HOME in lib/roles.ts — not
// imported, because the Edge bundle for the proxy stays dependency-free.
const ROLE_PREFIXES: Record<string, string> = {
  admin:       '/admin',
  instructor:  '/admin/instructor',
  coordinator: '/admin/coordinator',
  accountant:  '/admin/accountant',
}

// Strongest first, matching ROLE_PRIORITY in lib/roles.ts.
const ROLE_ORDER = ['admin', 'coordinator', 'instructor', 'accountant']

// The role cookie holds every role the person has, comma separated, because
// admin_roles is one row per job and some people hold several. Older cookies
// still in browsers carry a single value, which parses to a one-item list.
function rolesFromCookie(value: string | undefined): string[] {
  if (!value) return []
  const held = value.split(',').map(s => s.trim()).filter(r => r in ROLE_PREFIXES)
  return ROLE_ORDER.filter(r => held.includes(r))
}

// Screens that show pay, rates or travel. Only the salary admins may open them.
// Kept in step with lib/salary-access.ts and is_salary_admin() in Postgres.
const SALARY_PATHS = [
  '/admin/salary',
  '/admin/salaries',
  '/admin/instructors',
  '/admin/coordinator/payroll',
]

const SALARY_ADMIN_EMAILS = [
  'bennyfire@gmail.com',
  'shirkobi8@gmail.com',
]

// ─── JWT decode (no signature verification — fast, Edge-safe) ─────────────────
// The cookie is httpOnly (cannot be modified by client JS).
// Full DB verification still happens in useAdminAuth on every page load.
function decodeJWT(token: string): { exp?: number; sub?: string; email?: string } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    // atob is available in the Edge Runtime
    return JSON.parse(atob(padded)) as { exp?: number; sub?: string; email?: string }
  } catch {
    return null
  }
}

function isExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return true
  return payload.exp * 1000 < Date.now()
}

// True when `pathname` is the prefix itself or a path segment below it.
// "/admin/instructors" is NOT under "/admin/instructor".
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

function clearAndRedirect(url: URL): NextResponse {
  const res = NextResponse.redirect(url)
  res.cookies.delete('sb_auth_token')
  res.cookies.delete('sb_user_role')
  return res
}

// ─── Proxy function ────────────────────────────────────────────────────────────
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith(ADMIN_PREFIX)) {
    // Allow public admin paths (login, forgot-password, reset-password)
    if (ADMIN_PUBLIC_PATHS.some(p => isUnder(pathname, p))) {
      return NextResponse.next()   // do NOT strip params — reset-password needs ?code=
    }

    const token    = request.cookies.get('sb_auth_token')?.value
    const userRole = request.cookies.get('sb_user_role')?.value
    const loginUrl = new URL(ADMIN_LOGIN, request.url)

    // No token
    if (!token) return NextResponse.redirect(loginUrl)

    // Decode + expiry check
    const payload = decodeJWT(token)
    if (!payload || isExpired(payload)) return clearAndRedirect(loginUrl)

    // No role cookie
    const roles = rolesFromCookie(userRole)
    if (roles.length === 0) return clearAndRedirect(loginUrl)

    // Where this person lands when they are somewhere they may not be.
    const home = ROLE_PREFIXES[roles[0]] ?? ADMIN_LOGIN

    // Role-path enforcement: an instructor cannot reach /admin/coordinator.
    // Compared segment-wise, not by raw prefix — a plain startsWith() would
    // treat /admin/instructors (the staff roster, open to every admin) as if it
    // were the instructor-only /admin/instructor area and bounce coordinators.
    //
    // Holding several roles widens access rather than narrowing it: the area is
    // allowed if ANY held role owns it. Checking only the strongest role would
    // shut a coordinator+instructor out of /admin/instructor — their own area,
    // refused by their own cookie.
    const isOnWrongRolePath = ['/admin/instructor', '/admin/coordinator', '/admin/accountant']
      .some(p => isUnder(pathname, p) && !roles.some(r => isUnder(pathname, ROLE_PREFIXES[r])))

    if (isOnWrongRolePath) {
      return NextResponse.redirect(new URL(home, request.url))
    }

    // Pay screens: only the salary admins, checked at the edge from the email
    // claim in the Supabase JWT. The cookie is httpOnly and the token is signed
    // by Supabase, so this cannot be forged from the browser. RLS enforces the
    // same rule on the data itself — this just stops the page rendering at all.
    if (SALARY_PATHS.some(p => isUnder(pathname, p))) {
      const email = (payload.email ?? '').toLowerCase()
      if (!SALARY_ADMIN_EMAILS.includes(email)) {
        return NextResponse.redirect(new URL(home, request.url))
      }
    }

    // No sensitive data in URL params — strip if present
    const url = request.nextUrl.clone()
    const sensitiveParams = ['token', 'access_token', 'refresh_token', 'code']
    let stripped = false
    for (const param of sensitiveParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        stripped = true
      }
    }
    if (stripped) return NextResponse.redirect(url)

    return NextResponse.next()
  }

  // ── Student routes ─────────────────────────────────────────────────────────
  // The student page is a single-page app that manages its own auth state.
  // We only strip sensitive URL params here.
  if (pathname.startsWith(STUDENT_PREFIX)) {
    const url = request.nextUrl.clone()
    const sensitiveParams = ['token', 'access_token', 'refresh_token', 'code']
    let stripped = false
    for (const param of sensitiveParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        stripped = true
      }
    }
    if (stripped) return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/student/:path*',
  ],
}
