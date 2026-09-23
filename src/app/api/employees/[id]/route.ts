import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ROLE_IDS, type UserRole } from '@/lib/auth'
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await req.json(); const data: Record<string, unknown> = {}
    for (const key of ['name', 'email', 'phone', 'notes', 'active']) if (body?.[key] !== undefined) data[key] = key === 'active' ? Boolean(body[key]) : String(body[key])
    if (body?.role !== undefined) { const role = String(body.role) as UserRole; if (!ROLE_IDS.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 }); data.role = role }
    if (!Object.keys(data).length) return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    const employee = await db.employee.update({ where: { id }, data }); return NextResponse.json({ employee })
  } catch (err) { console.error('PATCH /api/employees/[id] failed', err); return NextResponse.json({ error: 'Failed to update employee profile' }, { status: 500 }) }
}
