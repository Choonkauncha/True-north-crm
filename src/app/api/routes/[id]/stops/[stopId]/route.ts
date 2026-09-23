import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/routes/:id/stops/:stopId — update a stop's status (visited/skipped)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; stopId: string }> }) {
  try {
    const { id, stopId } = await params
    const body = await req.json()
    const { status, notes } = body || {}

    const data: Record<string, unknown> = {}
    if (status !== undefined) {
      data.status = String(status)
      if (status === 'visited') data.visitedAt = new Date()
    }
    if (notes !== undefined) data.notes = String(notes)

    const stop = await db.canvassStop.update({
      where: { id: stopId },
      data,
    })
    return NextResponse.json({ stop })
  } catch (err) {
    console.error('PATCH /api/routes/:id/stops/:stopId failed', err)
    return NextResponse.json({ error: 'Failed to update stop' }, { status: 500 })
  }
}
