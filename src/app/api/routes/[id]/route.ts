import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/routes/:id — get a single route with stops
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const route = await db.canvassRoute.findUnique({
      where: { id },
      include: { stops: { orderBy: { order: 'asc' } } },
    })
    if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    return NextResponse.json({ route })
  } catch (err) {
    console.error('GET /api/routes/:id failed', err)
    return NextResponse.json({ error: 'Failed to load route' }, { status: 500 })
  }
}

// PATCH /api/routes/:id — update route (name, status, notes)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, status, notes } = body || {}

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = String(name)
    if (status !== undefined) data.status = String(status)
    if (notes !== undefined) data.notes = String(notes)
    if (status === 'completed') data.completedAt = new Date()

    const route = await db.canvassRoute.update({
      where: { id },
      data,
      include: { stops: { orderBy: { order: 'asc' } } },
    })
    return NextResponse.json({ route })
  } catch (err) {
    console.error('PATCH /api/routes/:id failed', err)
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 })
  }
}

// DELETE /api/routes/:id — delete a route
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.canvassRoute.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/routes/:id failed', err)
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 })
  }
}
