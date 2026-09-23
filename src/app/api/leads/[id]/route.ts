import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyAddress } from '@/lib/geocode'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const lead = await db.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ lead })
  } catch (err) {
    console.error('GET /api/leads/[id] failed', err)
    return NextResponse.json({ error: 'Failed to load lead' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const allowed = [
      'name', 'phone', 'email', 'street', 'city', 'state', 'zip',
      'source', 'territory', 'notes', 'stage', 'nextAction',
      'verifiedArea', 'pitch', 'contractFile'
    ]

    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key]
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const before = await db.lead.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const addressChanged = ['street', 'city', 'state', 'zip'].some((key) => data[key] !== undefined && String(data[key] ?? '') !== String((before as Record<string, unknown>)[key] ?? ''))
    if (addressChanged) {
      const address = [data.street ?? before.street, data.city ?? before.city, data.state ?? before.state, data.zip ?? before.zip].filter(Boolean).join(', ')
      try {
        const geo = await verifyAddress(address)
        data.latitude = geo.lat
        data.longitude = geo.lng
        data.formattedAddress = geo.formattedAddress
        data.geocodeStatus = 'verified'
        data.geocodeProvider = geo.provider
        data.geocodeAccuracy = geo.accuracy
        data.geocodeAccuracyType = geo.locationType
        data.stableAddressKey = geo.stableAddressKey
        data.geocodedAt = new Date()
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Address verification failed', code: 'ADDRESS_NEEDS_REVIEW' }, { status: 422 })
      }
    }

    const lead = await db.lead.update({ where: { id }, data })
    const session = await getSession()
    if (session) {
      const action = data.stage && before?.stage !== data.stage ? 'lead_stage_changed' : 'lead_updated'
      await db.activityLog.create({ data: { employeeId: session.employeeId, action, entityType: 'lead', entityId: lead.id, summary: `${action === 'lead_stage_changed' ? `Moved ${lead.street} to ${lead.stage}` : `Updated ${lead.street}`}` } })
    }
    return NextResponse.json({ lead })
  } catch (err) {
    console.error('PATCH /api/leads/[id] failed', err)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.lead.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/leads/[id] failed', err)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
