import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_LOGIN       = '/admin/login'
const ADMIN_PREFIX      = '/admin'
const STUDENT_PREFIX    = '/student'

const ROLE_PREFIXES: Record<string, string> = {
  instructor:  '/admin/instructor',
  coordinator: '/admin/coordinator',
  accountant:  '/admin/accountant',
}

// ─── JWT decode (no signature verification — fast, Edge-safe) ─────────────────
// The cookie is httpOnly (cannot be modified by client JS).
// Full DB verification still happens in useAdminAuth on every page load.
function decodeJWT(token: string): { exp?: number; sub?: string } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    // atob is available in the Edge Runtime
    return JSON.parse(atob(padded)) as { exp?: number; sub?: string }
  } catch {
    return null
  }
}

function isExpired(payload: { exp?: number }): boolean {
  if (!payload.exp) return true
  return payload.exp * 1000 < Date.now()
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
    // Allow /admin/login to pass through always
    if (pathname === ADMIN_LOGIN || pathname.startsWith(ADMIN_LOGIN + '/')) {
      return NextResponse.next()
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
    if (!userRole || !(userRole in ROLE_PREFIXES)) return clearAndRedirect(loginUrl)

    // Role-path enforcement: instructor cannot reach /admin/coordinator etc.
    const isOnWrongRolePath = ['/admin/instructor', '/admin/coordinator', '/admin/accountant']
      .some(p => pathname.startsWith(p) && !pathname.startsWith(ROLE_PREFIXES[userRole]!))

    if (isOnWrongRolePath) {
      return NextResponse.redirect(new URL(ROLE_PREFIXES[userRole]!, request.url))
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
