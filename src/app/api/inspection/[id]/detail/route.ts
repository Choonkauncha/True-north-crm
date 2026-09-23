import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/inspection/:id/detail
 * Returns the full inspection report with its linked lead (if any).
 * Powers the printable inspection report view.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const report = await db.inspectionReport.findUnique({ where: { id } })
    if (!report) {
      return NextResponse.json({ error: 'Inspection report not found' }, { status: 404 })
    }

    const lead = report.leadId
      ? await db.lead.findUnique({
          where: { id: report.leadId },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            street: true,
            city: true,
            state: true,
            zip: true,
            source: true,
            territory: true,
          },
        })
      : null

    return NextResponse.json({
      report: {
        id: report.id,
        leadId: report.leadId,
        photoDataUrl: report.photoDataUrl,
        windCount: report.windCount,
        hailCount: report.hailCount,
        missingCount: report.missingCount,
        totalCount: report.totalCount,
        recommendedIko: report.recommendedIko,
        summary: report.summary,
        source: report.source,
        createdAt: report.createdAt,
      },
      lead,
    })
  } catch (err) {
    console.error('GET /api/inspection/:id/detail failed', err)
    return NextResponse.json({ error: 'Failed to load inspection report' }, { status: 500 })
  }
}
