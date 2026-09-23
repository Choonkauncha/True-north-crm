import { NextRequest, NextResponse } from 'next/server'
import { authenticate, ROLE_IDS, ROLE_LABELS, SESSION_COOKIE, signSession, sessionCookieOptions, type UserRole } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const role = String(body?.role || '') as UserRole
    const password = String(body?.password || '')
    if (!ROLE_IDS.includes(role)) return NextResponse.json({ error: 'Choose a valid access level.' }, { status: 400 })
    if (!password) return NextResponse.json({ error: 'Password is required.' }, { status: 400 })

    const employeeId = body?.employeeId ? String(body.employeeId) : undefined
    const result = await authenticate(role, password, employeeId)
    if (!result) return NextResponse.json({ error: 'Invalid access password or inactive employee.' }, { status: 401 })
    if ('needsEmployeeSelection' in result) {
      return NextResponse.json({ ok: true, needsEmployeeSelection: true, employees: result.employees })
    }

    const session = result
    const res = NextResponse.json({
      ok: true,
      role: session.role,
      label: ROLE_LABELS[session.role],
      employeeName: session.employeeName,
    })
    res.cookies.set(SESSION_COOKIE, signSession(session), sessionCookieOptions())
    return res
  } catch (err) {
    console.error('POST /api/auth/login failed', err)
    return NextResponse.json({ error: 'Login is unavailable. Check the database and session secret.' }, { status: 500 })
  }
}
