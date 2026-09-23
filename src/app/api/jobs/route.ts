import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const jobs = await db.job.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('GET /api/jobs failed', err)
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { estimateId, leadId, property, contractValue, contractFilename, actualCost } = body || {}

    if (!property || String(property).trim() === '') {
      return NextResponse.json({ error: 'Property is required' }, { status: 400 })
    }
    if (contractValue === undefined || contractValue === null) {
      return NextResponse.json({ error: 'contractValue is required' }, { status: 400 })
    }

    let baseCost = actualCost !== undefined ? Number(actualCost) : 0
    if (estimateId && actualCost === undefined) {
      const est = await db.estimate.findUnique({ where: { id: String(estimateId) } })
      if (est) {
        baseCost = Number(est.directCost) || 0
      }
    }

    const value = Number(contractValue)
    const session = await getSession()
    const job = await db.job.create({
      data: {
        estimateId: estimateId ? String(estimateId) : null,
        leadId: leadId ? String(leadId) : null,
        property: String(property),
        contractValue: value,
        actualCost: baseCost,
        cashCollected: 0,
        balance: Math.max(0, value),
        contractFilename: contractFilename ? String(contractFilename) : null,
        status: 'scheduled',
        createdById: session?.employeeId || null,
      }
    })

    if (leadId) {
      try {
        await db.lead.update({
          where: { id: String(leadId) },
          data: {
            stage: 'contracted',
            contractFile: contractFilename ? String(contractFilename) : undefined,
            nextAction: 'Material delivery and crew schedule'
          }
        })
      } catch (e) {
        console.error('Failed to update lead after job creation', e)
      }
    }

    if (session) await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'job_created', entityType: 'job', entityId: job.id, summary: `Created job for ${job.property}` } })
    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    console.error('POST /api/jobs failed', err)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
