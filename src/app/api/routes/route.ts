import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/routes — list all saved routes
export async function GET(_req: NextRequest) {
  try {
    const routes = await db.canvassRoute.findMany({
      include: { stops: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ routes })
  } catch (err) {
    console.error('GET /api/routes failed', err)
    return NextResponse.json({ error: 'Failed to load routes' }, { status: 500 })
  }
}

// POST /api/routes — create a new route with stops
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, town, notes, stops } = body || {}

    if (!name || !Array.isArray(stops) || stops.length === 0) {
      return NextResponse.json({ error: 'name and stops are required' }, { status: 400 })
    }

    const route = await db.canvassRoute.create({
      data: {
        name: String(name),
        town: String(town || ''),
        notes: String(notes || ''),
        status: 'draft',
        stops: {
          create: stops.map((s: any, i: number) => ({
            leadId: s.leadId || null,
            street: String(s.street || ''),
            name: String(s.name || ''),
            lat: Number(s.lat) || 0,
            lng: Number(s.lng) || 0,
            order: i,
            status: 'pending',
          })),
        },
      },
      include: { stops: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ route }, { status: 201 })
  } catch (err) {
    console.error('POST /api/routes failed', err)
    return NextResponse.json({ error: 'Failed to create route' }, { status: 500 })
  }
}

// DELETE /api/routes — delete all routes (not typically used)
export async function DELETE(_req: NextRequest) {
  try {
    await db.canvassStop.deleteMany({})
    await db.canvassRoute.deleteMany({})
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/routes failed', err)
    return NextResponse.json({ error: 'Failed to clear routes' }, { status: 500 })
  }
}
