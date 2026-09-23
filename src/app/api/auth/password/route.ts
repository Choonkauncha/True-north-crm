import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hashPassword, ROLE_IDS, type UserRole } from '@/lib/auth'
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(); if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
    const body = await req.json(); const role = String(body?.role || '') as UserRole; const newPassword = String(body?.newPassword || '')
    if (!ROLE_IDS.includes(role)) return NextResponse.json({ error: 'Invalid access level.' }, { status: 400 })
    if (newPassword.length < 8) return NextResponse.json({ error: 'Use at least 8 characters.' }, { status: 400 })
    await db.accessCredential.upsert({ where: { role }, create: { role, passwordHash: hashPassword(newPassword) }, update: { passwordHash: hashPassword(newPassword) } })
    await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'access_password_changed', entityType: 'access', entityId: role, summary: `Changed ${role} access password` } })
    return NextResponse.json({ ok: true })
  } catch (err) { console.error('POST /api/auth/password failed', err); return NextResponse.json({ error: 'Failed to change access password' }, { status: 500 }) }
}
