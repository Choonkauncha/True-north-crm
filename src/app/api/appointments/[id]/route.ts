import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
const VALID_STATUSES = new Set(['yes', 'no', 'completed', 'cancelled'])
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const body = await req.json(); const data: Record<string, unknown> = {}
    if (body?.status !== undefined) { const status = String(body.status); if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid appointment status' }, { status: 400 }); data.status = status }
    if (body?.appointmentDate !== undefined) data.appointmentDate = body.appointmentDate === null || body.appointmentDate === '' ? null : new Date(String(body.appointmentDate))
    if (body?.notes !== undefined) data.notes = String(body.notes)
    if (!Object.keys(data).length) return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    const appointment = await db.appointment.update({ where: { id }, data }); const session = await getSession()
    if (session) await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'appointment_updated', entityType: 'appointment', entityId: appointment.id, summary: `Updated appointment at ${appointment.address}` } })
    return NextResponse.json({ appointment })
  } catch (err) { console.error('PATCH /api/appointments/[id] failed', err); return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 }) }
}
