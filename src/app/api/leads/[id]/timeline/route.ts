import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface TimelineEvent {
  type: 'lead_created' | 'stage_advanced' | 'inspection' | 'estimate' | 'job'
  title: string
  detail: string
  timestamp: string
}

/**
 * GET /api/leads/:id/timeline
 * Returns a chronological activity feed for a single lead, merging:
 * - the lead's own creation + last stage advancement
 * - linked VLM inspection reports
 * - linked estimates (with accept status)
 * - linked jobs (with cash collection status)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const lead = await db.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const [inspections, estimates, jobs] = await Promise.all([
      db.inspectionReport.findMany({ where: { leadId: id }, orderBy: { createdAt: 'desc' } }),
      db.estimate.findMany({ where: { leadId: id }, orderBy: { createdAt: 'desc' } }),
      db.job.findMany({ where: { leadId: id }, orderBy: { createdAt: 'desc' } }),
    ])

    const events: TimelineEvent[] = []

    // Lead creation
    events.push({
      type: 'lead_created',
      title: 'Lead captured',
      detail: `Source: ${lead.source || 'door_knock'} · Territory: ${lead.territory || '—'}`,
      timestamp: lead.createdAt.toISOString(),
    })

    // Stage advancement (only if updatedAt meaningfully differs from createdAt)
    if (lead.updatedAt.getTime() - lead.createdAt.getTime() > 60_000) {
      events.push({
        type: 'stage_advanced',
        title: `Advanced to "${lead.stage.replace(/_/g, ' ')}"`,
        detail: lead.nextAction || 'No next action set',
        timestamp: lead.updatedAt.toISOString(),
      })
    }

    // Verified measurement milestone
    if (lead.verifiedArea != null) {
      events.push({
        type: 'stage_advanced',
        title: 'Roof measurement verified',
        detail: `${Math.round(lead.verifiedArea)} sq ft surface area${lead.pitch != null ? ` · ${lead.pitch}/12 pitch` : ''}`,
        timestamp: lead.updatedAt.toISOString(),
      })
    }

    // Contract attached milestone
    if (lead.contractFile) {
      events.push({
        type: 'stage_advanced',
        title: 'Signed contract attached',
        detail: lead.contractFile,
        timestamp: lead.updatedAt.toISOString(),
      })
    }

    // Inspection reports
    for (const r of inspections) {
      const total = r.windCount + r.hailCount + r.missingCount
      events.push({
        type: 'inspection',
        title: `AI inspection — ${total} findings`,
        detail: `${r.windCount} wind · ${r.hailCount} hail · ${r.missingCount} missing · Rec: ${r.recommendedIko.toUpperCase()}`,
        timestamp: r.createdAt.toISOString(),
      })
    }

    // Estimates
    for (const e of estimates) {
      events.push({
        type: 'estimate',
        title: `Estimate ${e.status === 'accepted' ? 'accepted' : 'sent'} — $${Math.round(Number(e.price)).toLocaleString()}`,
        detail: `${e.product} · ${Number(e.area).toLocaleString()} sq ft · ${Number(e.squares).toFixed(1)} sq · ${Number(e.grossMarginPct).toFixed(1)}% margin`,
        timestamp: e.createdAt.toISOString(),
      })
    }

    // Jobs
    for (const j of jobs) {
      events.push({
        type: 'job',
        title: `Job ${j.status} — $${Math.round(Number(j.contractValue)).toLocaleString()}`,
        detail: `Cash: $${Math.round(Number(j.cashCollected)).toLocaleString()} / Balance: $${Math.round(Number(j.balance)).toLocaleString()}`,
        timestamp: (j.completedAt || j.createdAt).toISOString(),
      })
    }

    // Sort newest first
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    return NextResponse.json({ lead, events })
  } catch (err) {
    console.error('GET /api/leads/:id/timeline failed', err)
    return NextResponse.json({ error: 'Failed to load lead timeline' }, { status: 500 })
  }
}
