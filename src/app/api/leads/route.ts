import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyAddress } from '@/lib/geocode'

export async function GET(_req: NextRequest) {
  try {
    const leads = await db.lead.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ leads })
  } catch (err) {
    console.error('GET /api/leads failed', err)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, email, street, city, state, zip, source, territory, notes } = body || {}

    if (!street || String(street).trim() === '') {
      return NextResponse.json({ error: 'Street address is required' }, { status: 400 })
    }
    if (!city || String(city).trim() === '' || !state || String(state).trim() === '') {
      return NextResponse.json({ error: 'City and state are required for address verification' }, { status: 400 })
    }

    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const normalizedAddress = [String(street), String(city), String(state), String(zip ?? '')].filter(Boolean).join(', ')
    let geo
    try {
      geo = await verifyAddress(normalizedAddress)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Address verification failed', code: 'ADDRESS_NEEDS_REVIEW' }, { status: 422 })
    }

    const lead = await db.lead.create({
      data: {
        name: String(name ?? ''),
        phone: String(phone ?? ''),
        email: String(email ?? ''),
        street: String(street),
        city: String(city),
        state: String(state),
        zip: String(zip ?? ''),
        latitude: geo.lat,
        longitude: geo.lng,
        formattedAddress: geo.formattedAddress,
        geocodeStatus: 'verified',
        geocodeProvider: geo.provider,
        geocodeAccuracy: geo.accuracy,
        geocodeAccuracyType: geo.locationType,
        stableAddressKey: geo.stableAddressKey,
        geocodedAt: new Date(),
        source: String(source ?? 'door_knock'),
        territory: String(territory ?? 'Knox County'),
        notes: String(notes ?? ''),
        stage: 'new',
        nextAction: 'Initial contact and inspection scheduling',
        createdById: session?.employeeId || null,
      }
    })
    if (session) {
      await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'lead_created', entityType: 'lead', entityId: lead.id, summary: `Created lead at ${lead.street}` } })
    }
    return NextResponse.json({ lead }, { status: 201 })
  } catch (err) {
    console.error('POST /api/leads failed', err)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
