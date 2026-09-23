import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyzeRoofDamage } from '@/lib/ai'

export async function GET(_req: NextRequest) {
  try {
    const reports = await db.inspectionReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json({ reports })
  } catch (err) {
    console.error('GET /api/inspection failed', err)
    return NextResponse.json({ error: 'Failed to load inspection reports' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageDataUrl, leadId } = body || {}

    if (!imageDataUrl || String(imageDataUrl).trim() === '') {
      return NextResponse.json(
        { error: 'imageDataUrl is required' },
        { status: 400 }
      )
    }
    if (String(imageDataUrl).length > 3_500_000) {
      return NextResponse.json(
        { error: 'Photo is too large. Resize or compress the image and try again.' },
        { status: 413 }
      )
    }

    const detection = await analyzeRoofDamage(String(imageDataUrl))

    const report = await db.inspectionReport.create({
      data: {
        leadId: leadId ? String(leadId) : null,
        photoDataUrl: String(imageDataUrl),
        windCount: Number(detection.windCount),
        hailCount: Number(detection.hailCount),
        missingCount: Number(detection.missingCount),
        totalCount: Number(detection.totalCount),
        recommendedIko: String(detection.recommendedIko),
        summary: String(detection.summary),
        source: 'AI Vision (VLM)'
      }
    })

    if (leadId) {
      try {
        const lead = await db.lead.findUnique({ where: { id: String(leadId) } })
        if (lead) {
          const stamp = new Date().toLocaleDateString('en-US')
          const noteAppend = `\n[${stamp} AI Inspection]: ${detection.windCount} wind creases, ${detection.hailCount} hail impacts, ${detection.missingCount} missing shingles. Recommendation: IKO ${String(detection.recommendedIko).toUpperCase()}.`

          const updateData: Record<string, unknown> = {
            notes: (lead.notes || '') + noteAppend,
            nextAction: 'Present IKO proposal and claim documentation'
          }
          if (['new', 'contacted', 'inspection_set'].includes(lead.stage)) {
            updateData.stage = 'inspection_complete'
          }

          await db.lead.update({ where: { id: lead.id }, data: updateData })
        }
      } catch (e) {
        console.error('Failed to attach inspection to lead', e)
      }
    }

    return NextResponse.json({ report, detection })
  } catch (err) {
    console.error('POST /api/inspection failed', err)
    return NextResponse.json({ error: 'Failed to run inspection' }, { status: 500 })
  }
}
