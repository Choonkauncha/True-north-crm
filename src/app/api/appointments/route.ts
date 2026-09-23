import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
const VALID_STATUSES = new Set(['yes', 'no', 'completed', 'cancelled'])
export async function GET(req: NextRequest) {
  try {
    const leadId = req.nextUrl.searchParams.get('leadId')
    const appointments = await db.appointment.findMany({ where: leadId ? { leadId } : undefined, orderBy: { createdAt: 'desc' }, take: 100 })
    return NextResponse.json({ appointments })
  } catch (err) { console.error('GET /api/appointments failed', err); return NextResponse.json({ error: 'Failed to load appointments' }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); const leadId = String(body?.leadId || ''); const status = String(body?.status || 'no')
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    if (!VALID_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid appointment status' }, { status: 400 })
    const lead = await db.lead.findUnique({ where: { id: leadId } }); if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    const session = await getSession()
    const appointment = await db.appointment.create({ data: { leadId, address: [lead.street, lead.city, lead.state, lead.zip].filter(Boolean).join(', '), status, appointmentDate: body?.appointmentDate ? new Date(String(body.appointmentDate)) : null, notes: String(body?.notes || ''), createdById: session?.employeeId || null } })
    if (session) await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'appointment_recorded', entityType: 'appointment', entityId: appointment.id, summary: `${status === 'yes' ? 'Appointment set' : 'No appointment'} at ${appointment.address}` } })
    return NextResponse.json({ appointment }, { status: 201 })
  } catch (err) { console.error('POST /api/appointments failed', err); return NextResponse.json({ error: 'Failed to save appointment' }, { status: 500 }) }
}
