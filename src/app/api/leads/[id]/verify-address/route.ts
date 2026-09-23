import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyAddress } from '@/lib/geocode'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const lead = await db.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  const address = [lead.street, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')
  try {
    const geo = await verifyAddress(address)
    const updated = await db.lead.update({ where: { id }, data: { latitude: geo.lat, longitude: geo.lng, formattedAddress: geo.formattedAddress, geocodeStatus: 'verified', geocodeProvider: geo.provider, geocodeAccuracy: geo.accuracy, geocodeAccuracyType: geo.locationType, stableAddressKey: geo.stableAddressKey, geocodedAt: new Date() } })
    await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'address_verified', entityType: 'lead', entityId: id, summary: `Verified property address ${geo.formattedAddress}` } })
    return NextResponse.json({ lead: updated })
  } catch (err) {
    await db.lead.update({ where: { id }, data: { geocodeStatus: 'needs_review', latitude: null, longitude: null, formattedAddress: null, geocodeProvider: null, geocodeAccuracy: null, geocodeAccuracyType: null, stableAddressKey: null, geocodedAt: null } })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Address verification failed', code: 'ADDRESS_NEEDS_REVIEW' }, { status: 422 })
  }
}
