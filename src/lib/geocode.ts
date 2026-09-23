/**
 * True North address verification via Geocodio.
 * Geocodio is used for server-side address verification; Google Maps remains
 * available for navigation/Street View links in the UI.
 */
const ACCEPTED_ACCURACY_TYPES = new Set(['rooftop', 'point', 'range_interpolation'])

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const STATE_ALIASES: Record<string, string> = { ohio: 'oh', oh: 'oh' }

export interface VerifiedGeocode {
  lat: number
  lng: number
  formattedAddress: string
  provider: 'geocodio'
  locationType: string
  accuracy: number
  stableAddressKey: string | null
}

function providerError(status: number, body: unknown) {
  if (status === 401) return new Error('Geocodio rejected the API key. Check GEOCODIO_API_KEY in Vercel.')
  if (status === 403) {
    const detail = typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error ?? '') : ''
    return new Error(detail || 'Geocodio denied the request. Check the API key permissions or account usage limit.')
  }
  if (status === 429) return new Error('Geocodio free daily lookup limit has been reached. Try again later.')
  if (status >= 500) return new Error('Geocodio is temporarily unavailable. Try again in a moment.')
  const detail = typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error ?? '') : ''
  return new Error(detail || 'Geocodio could not process the address.')
}

export async function verifyAddress(address: string): Promise<VerifiedGeocode> {
  const key = process.env.GEOCODIO_API_KEY
  if (!key) throw new Error('Address verification is not configured. Add GEOCODIO_API_KEY in Vercel.')

  const params = new URLSearchParams({ q: address.trim(), country: 'USA', api_key: key, limit: '5' })
  const response = await fetch(`https://api.enterprise.geocod.io/v2/geocode?${params.toString()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const raw = await response.text()
  let data: any = null
  try { data = JSON.parse(raw) } catch { /* provider returned non-JSON */ }
  if (!response.ok) throw providerError(response.status, data)

  const result = data?.results?.[0]
  if (!result?.location || !result?.formatted_address) {
    throw new Error('Address could not be verified. Correct the street, city, state, or ZIP and try again.')
  }

  const components = result.address_components || {}
  const country = String(components.country || '').toUpperCase()
  const state = String(components.state_province || '')
  const postal = String(components.postal_code || '')
  const number = String(components.number || '')
  const street = String(components.formatted_street || components.street || '')
  const accuracy = Number(result.accuracy ?? 0)
  const locationType = String(result.accuracy_type || '').toLowerCase()

  const inputParts = address.split(',').map((part) => part.trim()).filter(Boolean)
  // Leads are normalized as street, city, state, zip. The previous implementation
  // used inputParts[-2], which becomes "OH 43050" when a ZIP is present and
  // incorrectly rejected otherwise-valid Ohio addresses.
  const inputStateRaw = inputParts.length >= 3 ? inputParts[2] : ''
  const inputState = STATE_ALIASES[normalize(inputStateRaw)] || normalize(inputStateRaw)
  const inputZipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/)

  if (country !== 'US' || !number || !street) {
    throw new Error('The result is not a verified US street address. Correct the property address before routing.')
  }
  if (inputState && normalize(state) !== inputState) {
    throw new Error('The verified address is in a different state than the address entered.')
  }
  if (inputZipMatch && postal && !postal.startsWith(inputZipMatch[0].slice(0, 5))) {
    throw new Error('The verified ZIP code does not match the ZIP entered.')
  }

  if (!ACCEPTED_ACCURACY_TYPES.has(locationType) || accuracy < 0.8) {
    throw new Error(`Geocodio found the address but only with approximate location data (${locationType || 'unknown'}, accuracy ${accuracy || 0}). Correct the address before using it for routing.`)
  }

  const lat = Number(result.location.lat)
  const lng = Number(result.location.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Geocodio returned invalid coordinates for this address.')

  return {
    lat,
    lng,
    formattedAddress: String(result.formatted_address),
    provider: 'geocodio',
    locationType,
    accuracy,
    stableAddressKey: result.stable_address_key ? String(result.stable_address_key) : null,
  }
}
