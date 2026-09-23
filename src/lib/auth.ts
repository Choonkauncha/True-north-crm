import { cookies } from 'next/headers'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'

export const ROLE_IDS = ['admin', 'sales', 'setter'] as const
export type UserRole = typeof ROLE_IDS[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  sales: 'Sales Rep',
  setter: 'Appointment Setter',
}

export const DEFAULT_PASSWORDS: Record<UserRole, string> = {
  admin: 'Admin123!',
  sales: 'Sales123!',
  setter: 'Setter123!',
}

export const SESSION_COOKIE = 'tn_session'
const SESSION_DAYS = 7

export interface AuthSession {
  role: UserRole
  employeeId: string
  employeeName: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.TN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('TN_SESSION_SECRET must be configured with at least 32 characters.')
  }
  return secret
}

function b64(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function unb64(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hexHash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hexHash) return false
  try {
    const actual = scryptSync(password, salt, 64)
    const expected = Buffer.from(hexHash, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function signSession(session: AuthSession): string {
  const payload = b64(JSON.stringify(session))
  const signature = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySession(token: string | undefined | null): AuthSession | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  try {
    const expected = createHmac('sha256', getSecret()).update(payload).digest('base64url')
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const session = JSON.parse(unb64(payload)) as AuthSession
    if (!session || !ROLE_IDS.includes(session.role) || !session.employeeId || !session.exp) return null
    if (Date.now() >= session.exp) return null
    return session
  } catch {
    return null
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies()
  const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!session) return null

  const employee = await db.employee.findFirst({
    where: { id: session.employeeId, role: session.role, active: true },
    select: { id: true, name: true },
  })
  if (!employee) return null

  return { ...session, employeeName: employee.name }
}

export async function ensureRoleCredential(role: UserRole) {
  const existing = await db.accessCredential.findUnique({ where: { role } })
  if (existing) return existing
  return db.accessCredential.create({
    data: {
      role,
      passwordHash: hashPassword(DEFAULT_PASSWORDS[role]),
    },
  })
}

export async function ensureEmployee(role: UserRole) {
  const existing = await db.employee.findFirst({
    where: { role, active: true },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing
  return db.employee.create({
    data: {
      name: ROLE_LABELS[role],
      role,
      active: true,
    },
  })
}

export async function authenticate(role: UserRole, password: string, employeeId?: string) {
  await ensureRoleCredential(role)
  const credential = await db.accessCredential.findUnique({ where: { role } })
  if (!credential || !verifyPassword(password, credential.passwordHash)) return null

  let employee = employeeId
    ? await db.employee.findFirst({ where: { id: employeeId, role, active: true } })
    : null

  if (!employee) {
    const employees = await db.employee.findMany({
      where: { role, active: true },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true, email: true },
    })
    if (employees.length > 1) {
      return { needsEmployeeSelection: true as const, employees }
    }
    employee = await ensureEmployee(role)
  }

  if (!employee) return null

  await db.employee.update({
    where: { id: employee.id },
    data: { lastLoginAt: new Date() },
  })
  await db.activityLog.create({
    data: {
      employeeId: employee.id,
      action: 'login',
      entityType: 'auth',
      entityId: employee.id,
      summary: `${ROLE_LABELS[role]} employee ${employee.name} logged in`,
    },
  })

  const session: AuthSession = {
    role,
    employeeId: employee.id,
    employeeName: employee.name,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  }
  return session
}

export function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    // The v0 preview runs inside a cross-site iframe, which only accepts SameSite=None; Secure cookies.
    secure: true,
    sameSite: isProduction ? ('lax' as const) : ('none' as const),
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  }
}

export function routeAllows(role: UserRole, pathname: string, method: string): boolean {
  if (role === 'admin') return true
  const read = ['GET', 'HEAD', 'OPTIONS'].includes(method)

  if (pathname === '/api/auth/me' || pathname === '/api/auth/logout') return true
  if (pathname.startsWith('/api/copilot')) return role === 'sales'
  if (pathname.startsWith('/api/metrics')) return false
  if (pathname.startsWith('/api/backup')) return false
  if (pathname.startsWith('/api/jobs')) return false
  if (pathname.startsWith('/api/profiles')) return false
  if (pathname.startsWith('/api/prices')) return false
  if (pathname.startsWith('/api/catalog')) return role === 'sales' && read
  if (pathname.startsWith('/api/estimate-calc')) return role === 'sales'
  if (pathname.startsWith('/api/estimates')) return role === 'sales'
  if (pathname.startsWith('/api/measure')) return role === 'sales'
  if (pathname.startsWith('/api/inspection')) return role === 'sales'
  if (pathname.startsWith('/api/photo-bank')) return role === 'sales'
  if (pathname.startsWith('/api/aerial-scan')) return role === 'sales'
  if (pathname.startsWith('/api/routes/suggest')) return role === 'sales'
  if (pathname.startsWith('/api/routes')) return role === 'sales' || role === 'setter'
  if (pathname.startsWith('/api/appointments')) return role === 'sales' || role === 'setter'
  if (pathname.startsWith('/api/crm')) return role === 'sales' || role === 'setter'
  if (pathname.startsWith('/api/employees')) return false
  if (pathname.startsWith('/api/leads')) return role === 'sales' || role === 'setter'
  return false
}
