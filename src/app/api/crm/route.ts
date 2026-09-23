import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  try {
    const leads = await db.lead.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { appointments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    return NextResponse.json({
      records: leads.map(({ appointments, ...lead }) => ({ ...lead, latestAppointment: appointments[0] || null })),
    })
  } catch (err) {
    console.error('GET /api/crm failed', err)
    return NextResponse.json({ error: 'Failed to load CRM records' }, { status: 500 })
  }
}
