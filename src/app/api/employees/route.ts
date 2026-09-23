import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ROLE_IDS, type UserRole } from '@/lib/auth'
export async function GET(_req: NextRequest) {
  try {
    const employees = await db.employee.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
    const [leadCounts, estimateCounts, appointmentCounts, jobCounts] = await Promise.all([
      db.lead.groupBy({ by: ['createdById'], _count: { _all: true } }), db.estimate.groupBy({ by: ['createdById'], _count: { _all: true } }), db.appointment.groupBy({ by: ['createdById'], _count: { _all: true } }), db.job.groupBy({ by: ['createdById'], _count: { _all: true } }),
    ])
    const countMap = (rows: Array<{ createdById: string | null; _count: { _all: number } }>) => new Map(rows.filter(r => r.createdById).map(r => [r.createdById!, r._count._all]))
    const lm = countMap(leadCounts), em = countMap(estimateCounts), am = countMap(appointmentCounts), jm = countMap(jobCounts)
    return NextResponse.json({ employees: employees.map(e => ({ ...e, role: e.role as UserRole, metrics: { leads: lm.get(e.id) || 0, estimates: em.get(e.id) || 0, appointments: am.get(e.id) || 0, jobs: jm.get(e.id) || 0 } })) })
  } catch (err) { console.error('GET /api/employees failed', err); return NextResponse.json({ error: 'Failed to load employee profiles' }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); const name = String(body?.name || '').trim(); const role = String(body?.role || '') as UserRole
    if (!name) return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
    if (!ROLE_IDS.includes(role)) return NextResponse.json({ error: 'Valid employee role is required' }, { status: 400 })
    const employee = await db.employee.create({ data: { name, role, email: String(body?.email || ''), phone: String(body?.phone || ''), notes: String(body?.notes || ''), active: body?.active !== false } })
    return NextResponse.json({ employee }, { status: 201 })
  } catch (err) { console.error('POST /api/employees failed', err); return NextResponse.json({ error: 'Failed to create employee profile' }, { status: 500 }) }
}
