import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_STATUSES = ['accepted', 'rejected', 'expired']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status } = body || {}

    if (!status || !VALID_STATUSES.includes(String(status))) {
      return NextResponse.json(
        { error: 'status must be one of accepted|rejected|expired' },
        { status: 400 }
      )
    }

    const existing = await db.estimate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const estimate = await db.estimate.update({
      where: { id },
      data: { status: String(status) }
    })

    if (status === 'accepted' && existing.leadId) {
      try {
        await db.lead.update({
          where: { id: existing.leadId },
          data: {
            stage: 'follow_up',
            nextAction: 'Sign contract with homeowner'
          }
        })
      } catch (e) {
        console.error('Failed to update lead after estimate acceptance', e)
      }
    }

    return NextResponse.json({ estimate })
  } catch (err) {
    console.error('PATCH /api/estimates/[id] failed', err)
    return NextResponse.json({ error: 'Failed to update estimate' }, { status: 500 })
  }
}
