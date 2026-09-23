import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { verifyAddress } from '@/lib/geocode'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const address = req.nextUrl.searchParams.get('address')?.trim()
  if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })

  try {
    const geo = await verifyAddress(address)
    return NextResponse.json({
      verified: true,
      provider: geo.provider,
      formattedAddress: geo.formattedAddress,
      stableAddressKey: geo.stableAddressKey,
      accuracy: geo.accuracy,
      accuracyType: geo.locationType,
      lat: geo.lat,
      lng: geo.lng,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Address verification failed'
    const status = /not configured|API key|daily lookup limit|temporarily unavailable/i.test(message) ? 503 : 422
    return NextResponse.json({ error: message, code: status === 503 ? 'GEOCODING_SERVICE_ERROR' : 'ADDRESS_NEEDS_REVIEW' }, { status })
  }
}
