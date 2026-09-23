/**
 * True North address verification via Geocodio.
 * Geocodio is used for server-side address verification; Google Maps remains
 * available for navigation/Street View links in the UI.
 */
const ACCEPTED_ACCURACY_TYPES = new Set(['rooftop', 'point', 'range_interpolation'])

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const STATE_NAMES: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca', colorado: 'co', connecticut: 'ct',
  delaware: 'de', districtofcolumbia: 'dc', florida: 'fl', georgia: 'ga', hawaii: 'hi', idaho: 'id', illinois: 'il',
  indiana: 'in', iowa: 'ia', kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms', missouri: 'mo', montana: 'mt',
  nebraska: 'ne', nevada: 'nv', newhampshire: 'nh', newjersey: 'nj', newmexico: 'nm', newyork: 'ny',
  northcarolina: 'nc', northdakota: 'nd', ohio: 'oh', oklahoma: 'ok', oregon: 'or', pennsylvania: 'pa',
  rhodeisland: 'ri', southcarolina: 'sc', southdakota: 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut',
  vermont: 'vt', virginia: 'va', washington: 'wa', westvirginia: 'wv', wisconsin: 'wi', wyoming: 'wy',
}
const STATE_CODES = new Set(Object.values(STATE_NAMES))

function toStateCode(value: string): string {
  const n = normalize(value)
  if (STATE_CODES.has(n)) return n
  return STATE_NAMES[n] || ''
}

// Finds the state in "street, city, ST 12345" / "street, city, State, 12345" / "street, apt, city, ST" forms,
// scanning from the end so city names and unit lines are never mistaken for the state.
function extractInputState(address: string): string {
  const parts = address.split(',').map((p) => p.replace(/\b\d{5}(?:-\d{4})?\b/g, '').replace(/\busa?\b|united states/gi, '').trim()).filter(Boolean)
  for (let i = parts.length - 1; i >= 1; i--) {
    const code = toStateCode(parts[i])
    if (code) return code
    const words = parts[i].split(/\s+/)
    const lastWord = toStateCode(words[words.length - 1] || '')
    if (lastWord && words[words.length - 1].length === 2) return lastWord
  }
  return ''
}

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
    if (/invalid api key/i.test(detail)) {
      return new Error('Geocodio says the API key is invalid. Copy the key from dash.geocod.io > API Keys into GEOCODIO_API_KEY (no quotes or spaces), then redeploy.')
    }
    return new Error(detail || 'Geocodio denied the request. Check the API key permissions or account usage limit.')
  }
  if (status === 429) return new Error('Geocodio free daily lookup limit has been reached. Try again later.')
  if (status >= 500) return new Error('Geocodio is temporarily unavailable. Try again in a moment.')
  const detail = typeof body === 'object' && body && 'error' in body ? String((body as { error?: unknown }).error ?? '') : ''
  return new Error(detail || 'Geocodio could not process the address.')
}

export async function verifyAddress(address: string): Promise<VerifiedGeocode> {
  // Values pasted into env settings often carry whitespace or wrapping quotes, which Geocodio rejects as invalid.
  const key = (process.env.GEOCODIO_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim()
  if (!key) throw new Error('Address verification is not configured. Add GEOCODIO_API_KEY in Vercel.')

  // Standard accounts must use api.geocod.io; the enterprise host rejects their keys as "Invalid API key".
  const baseUrl = (process.env.GEOCODIO_API_URL || 'https://api.geocod.io/v1.9').replace(/\/+$/, '')
  const params = new URLSearchParams({ q: address.trim(), country: 'USA', api_key: key, limit: '5' })
  const response = await fetch(`${baseUrl}/geocode?${params.toString()}`, {
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
  const state = String(components.state || components.state_province || '')
  const postal = String(components.postal_code || '')
  const number = String(components.number || '')
  const street = String(components.formatted_street || components.street || '')
  const accuracy = Number(result.accuracy ?? 0)
  const locationType = String(result.accuracy_type || '').toLowerCase()

  const inputState = extractInputState(address)
  const inputZipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/)

  if (country !== 'US' || !number || !street) {
    throw new Error('The result is not a verified US street address. Correct the property address before routing.')
  }
  if (inputState && toStateCode(state) !== inputState) {
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
