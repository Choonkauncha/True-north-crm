import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'tn_session'
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/favicon.ico', '/robots.txt', '/true-north-logo.png', '/roof-sample-damage.jpg', '/logo.svg'])

async function verifySession(token: string | undefined): Promise<{ role: 'admin' | 'sales' | 'setter' } | null> {
  if (!token) return null
  const secret = process.env.TN_SESSION_SECRET
  if (!secret || secret.length < 32) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(signature.length / 4) * 4, '=')), c => c.charCodeAt(0))
    const payloadBytes = new TextEncoder().encode(payload)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)
    if (!valid) return null
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')), c => c.charCodeAt(0))))
    if (!json?.role || !['admin', 'sales', 'setter'].includes(json.role) || Date.now() >= Number(json.exp || 0)) return null
    return { role: json.role }
  } catch {
    return null
  }
}

function allowed(role: 'admin' | 'sales' | 'setter', pathname: string, method: string) {
  if (role === 'admin') return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/api/employees')) return false
  if (pathname.startsWith('/api/backup')) return false
  if (pathname.startsWith('/api/jobs')) return false
  if (pathname.startsWith('/api/profiles')) return false
  if (pathname.startsWith('/api/prices')) return false
  if (pathname.startsWith('/api/metrics')) return false
  if (pathname.startsWith('/api/leads') && method === 'DELETE') return false
  if (role === 'setter') {
    if (pathname.startsWith('/api/routes/suggest') || pathname.startsWith('/api/aerial-scan')) return false
    return pathname.startsWith('/api/crm') || pathname.startsWith('/api/appointments') || pathname.startsWith('/api/leads') || pathname.startsWith('/api/routes')
  }
  return (
    pathname.startsWith('/api/leads') || pathname.startsWith('/api/crm') || pathname.startsWith('/api/appointments') ||
    pathname.startsWith('/api/routes') || pathname.startsWith('/api/estimate-calc') || pathname.startsWith('/api/estimates') ||
    pathname.startsWith('/api/measure') || pathname.startsWith('/api/inspection') || pathname.startsWith('/api/catalog') ||
    pathname.startsWith('/api/photo-bank') || pathname.startsWith('/api/aerial-scan') || pathname.startsWith('/api/copilot')
  )
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/auth/login') || PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/api/') && !allowed(session.role, pathname, req.method)) {
    return NextResponse.json({ error: 'This access level does not have permission for this feature.' }, { status: 403 })
  }

  const res = NextResponse.next()
  res.headers.set('X-True-North-Role', session.role)
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
