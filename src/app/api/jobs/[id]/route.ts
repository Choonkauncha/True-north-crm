import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { actualCost, cashCollected, status, startDate, completedAt } = body || {}

    const existing = await db.job.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (actualCost !== undefined) data.actualCost = Number(actualCost)
    if (cashCollected !== undefined) data.cashCollected = Number(cashCollected)
    if (status !== undefined) data.status = String(status)
    if (startDate !== undefined) {
      data.startDate = startDate === null ? null : new Date(startDate)
    }
    if (completedAt !== undefined) {
      data.completedAt = completedAt === null ? null : new Date(completedAt)
    }

    // Recompute balance
    const newCash = cashCollected !== undefined ? Number(cashCollected) : existing.cashCollected
    data.balance = Math.max(0, existing.contractValue - newCash)

    // If status is completed and no completedAt provided, set to now
    if (status === 'completed' && completedAt === undefined && !existing.completedAt) {
      data.completedAt = new Date()
    }

    const job = await db.job.update({ where: { id }, data })
    return NextResponse.json({ job })
  } catch (err) {
    console.error('PATCH /api/jobs/[id] failed', err)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}
