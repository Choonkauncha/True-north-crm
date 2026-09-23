import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// Batch satellite + VLM scans can legitimately run longer than a normal CRUD request.
export const runtime = 'nodejs'
export const maxDuration = 300

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZai() {
  if (!_zai) _zai = await ZAI.create()
  return _zai
}

// ─── Tile math: lat/lng → tile x/y at given zoom ─────────────────────────────────

function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

// ─── Fetch satellite tiles and stitch into a single base64 image ──────────────────

async function fetchSatelliteImage(lat: number, lng: number): Promise<string> {
  const zoom = 19
  const tile = latLngToTile(lat, lng, zoom)

  // Fetch a 2x2 grid of tiles centered on the target for better roof visibility
  const tileUrls = [
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y}/${tile.x}`,
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y}/${tile.x + 1}`,
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y + 1}/${tile.x}`,
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tile.y + 1}/${tile.x + 1}`,
  ]

  // Fetch all 4 tiles
  const tileBuffers: Buffer[] = []
  for (const url of tileUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`tile fetch failed: ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      tileBuffers.push(buf)
    } catch {
      // If any tile fails, return empty — the VLM will report "unknown"
      return ''
    }
  }

  if (tileBuffers.length < 4) return ''

  // Stitch the 4 tiles (256x256 each) into a 512x512 image using sharp
  try {
    const sharp = (await import('sharp')).default
    const tileSize = 256
    const composite = sharp({
      create: {
        width: tileSize * 2,
        height: tileSize * 2,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })

    const tilesWithPositions = tileBuffers.map((buf, i) => ({
      input: buf,
      top: Math.floor(i / 2) * tileSize,
      left: (i % 2) * tileSize,
    }))

    const stitched = await composite.composite(tilesWithPositions).jpeg({ quality: 85 }).toBuffer()
    return `data:image/jpeg;base64,${stitched.toString('base64')}`
  } catch {
    // If sharp fails, try just using the first tile
    try {
      return `data:image/jpeg;base64,${tileBuffers[0].toString('base64')}`
    } catch {
      return ''
    }
  }
}

// ─── VLM roof condition analysis ──────────────────────────────────────────────────

const ROOF_SCAN_PROMPT = `You are an AI roofing inspection assistant analyzing a satellite image of a residential property roof. 

Assess the visible roof condition. Look for:
- Missing, displaced, or dark shingles (appear as dark patches)
- Discoloration or staining (indicates moisture, algae, or aging)
- Sagging or uneven roof planes
- Debris accumulation
- Tree overhang or tree damage
- Irregular patching or repair marks
- Hail impact marks (circular dark spots)

Respond ONLY with valid JSON (no markdown, no prose):
{
  "conditionScore": <1-10 where 10=pristine and 1=severely damaged>,
  "condition": "<good|fair|poor>",
  "findings": "<one concise sentence summarizing the roof condition>",
  "indicators": ["<specific finding 1>", "<specific finding 2>"]
}

Rules:
- condition "good" = score 8-10 (no visible issues)
- condition "fair" = score 5-7 (minor aging, some wear)
- condition "poor" = score 1-4 (visible damage, missing shingles, sagging)
- If the image is not a roof, is obscured by clouds, or is under heavy tree cover, return: {"conditionScore": 0, "condition": "unknown", "findings": "Unable to assess - image obscured or not a roof", "indicators": []}`

interface VlmRoofResult {
  conditionScore: number
  condition: 'unknown' | 'good' | 'fair' | 'poor'
  findings: string
  indicators: string[]
}

async function analyzeRoofFromSatellite(imageDataUrl: string): Promise<VlmRoofResult> {
  const zai = await getZai()
  const response = await zai.chat.completions.createVision({
    model: process.env.ZAI_VISION_MODEL || 'glm-4.5v',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: ROOF_SCAN_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = response.choices[0]?.message?.content || ''

  // Extract JSON from the response
  let parsed: any = null
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      // fall through to defaults
    }
  }

  const score = Number(parsed?.conditionScore ?? 0)
  const condition = String(parsed?.condition ?? 'unknown') as VlmRoofResult['condition']
  const findings = String(parsed?.findings ?? 'VLM analysis complete.')
  const indicators = Array.isArray(parsed?.indicators) ? parsed.indicators.map(String) : []

  return {
    conditionScore: Math.max(0, Math.min(10, score)),
    condition: ['good', 'fair', 'poor', 'unknown'].includes(condition) ? condition : 'unknown',
    findings,
    indicators,
  }
}

// ─── API handlers ─────────────────────────────────────────────────────────────────

// GET /api/aerial-scan — list all scans (newest first)
export async function GET(_req: NextRequest) {
  try {
    const scans = await db.aerialScan.findMany({
      orderBy: { scannedAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ scans })
  } catch (err) {
    console.error('GET /api/aerial-scan failed', err)
    return NextResponse.json({ error: 'Failed to load scans' }, { status: 500 })
  }
}

// POST /api/aerial-scan — scan a single lead or batch
// Body: { leadId, lat, lng, address } for single
// Body: { leadIds: [] } for batch (uses geocoded leads from DB)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, lat, lng, address, leadIds } = body || {}

    // ─── Batch mode ───
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      if (leadIds.length > 20) {
        return NextResponse.json({ error: 'Batch roof scans are limited to 20 properties per request.' }, { status: 400 })
      }
      const results: Array<{ leadId: string; success: boolean; condition?: string; score?: number; error?: string }> = []

      for (const id of leadIds) {
        try {
          const lead = await db.lead.findUnique({ where: { id } })
          if (!lead) {
            results.push({ leadId: id, success: false, error: 'Lead not found' })
            continue
          }

          // Use the verified coordinates already stored on the lead. Never silently
          // re-geocode a property with a different provider for an aerial scan.
          if (lead.geocodeStatus !== 'verified' || lead.latitude == null || lead.longitude == null) {
            results.push({ leadId: id, success: false, error: 'Address must be verified before an aerial scan.' })
            continue
          }

          const scanLat = lead.latitude
          const scanLng = lead.longitude
          const scanAddress = `${lead.street}, ${lead.city}, ${lead.state}`

          // Fetch satellite image
          const imageDataUrl = await fetchSatelliteImage(scanLat, scanLng)
          if (!imageDataUrl) {
            results.push({ leadId: id, success: false, error: 'Satellite image fetch failed' })
            continue
          }

          // Run VLM analysis
          const vlmResult = await analyzeRoofFromSatellite(imageDataUrl)

          // Save to DB
          const scan = await db.aerialScan.create({
            data: {
              leadId: id,
              lat: scanLat,
              lng: scanLng,
              address: scanAddress,
              conditionScore: vlmResult.conditionScore,
              condition: vlmResult.condition,
              findings: vlmResult.findings,
              indicators: JSON.stringify(vlmResult.indicators),
              imageDataUrl,
            },
          })

          results.push({
            leadId: id,
            success: true,
            condition: vlmResult.condition,
            score: vlmResult.conditionScore,
          })

          // Rate limit: 2s between VLM calls
          await new Promise(r => setTimeout(r, 2000))
        } catch (e) {
          results.push({ leadId: id, success: false, error: (e as Error).message })
        }
      }

      return NextResponse.json({ results })
    }

    // ─── Single mode ───
    if (!lat || !lng || !address) {
      return NextResponse.json({ error: 'lat, lng, and address are required (or use leadIds for batch)' }, { status: 400 })
    }

    // Fetch satellite image
    const imageDataUrl = await fetchSatelliteImage(Number(lat), Number(lng))
    if (!imageDataUrl) {
      return NextResponse.json({ error: 'Failed to fetch satellite image' }, { status: 500 })
    }

    // Run VLM analysis
    const vlmResult = await analyzeRoofFromSatellite(imageDataUrl)

    // Save to DB
    const scan = await db.aerialScan.create({
      data: {
        leadId: leadId || null,
        lat: Number(lat),
        lng: Number(lng),
        address: String(address),
        conditionScore: vlmResult.conditionScore,
        condition: vlmResult.condition,
        findings: vlmResult.findings,
        indicators: JSON.stringify(vlmResult.indicators),
        imageDataUrl,
      },
    })

    return NextResponse.json({ scan }, { status: 201 })
  } catch (err) {
    console.error('POST /api/aerial-scan failed', err)
    return NextResponse.json({ error: 'Failed to run aerial scan' }, { status: 500 })
  }
}
