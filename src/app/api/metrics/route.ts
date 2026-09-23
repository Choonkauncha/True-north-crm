import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { LEAD_STAGES } from '@/lib/tn-storage'

interface ActivityItem {
  type: 'lead_created' | 'lead_stage' | 'estimate_created' | 'estimate_accepted' | 'job_created' | 'job_completed' | 'inspection'
  label: string
  detail: string
  timestamp: string
  refId: string
}

/**
 * Build a unified recent-activity feed by merging the latest rows from each
 * operational table, sorted by creation time descending.
 */
async function buildRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const [leads, estimates, jobs, inspections] = await Promise.all([
    db.lead.findMany({ orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, street: true, name: true, stage: true, createdAt: true, updatedAt: true } }),
    db.estimate.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, property: true, product: true, price: true, status: true, createdAt: true } }),
    db.job.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, property: true, contractValue: true, status: true, createdAt: true, completedAt: true } }),
    db.inspectionReport.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, windCount: true, hailCount: true, missingCount: true, createdAt: true } }),
  ])

  const items: ActivityItem[] = []

  for (const l of leads) {
    // Emit a "created" entry on first appearance
    items.push({
      type: 'lead_created',
      label: `New lead: ${l.street}`,
      detail: l.name || 'Unknown customer',
      timestamp: l.createdAt.toISOString(),
      refId: l.id,
    })
    // Emit a "stage change" entry using updatedAt if it differs meaningfully
    if (l.updatedAt.getTime() - l.createdAt.getTime() > 60_000) {
      items.push({
        type: 'lead_stage',
        label: `${l.street} → ${l.stage.replace(/_/g, ' ')}`,
        detail: 'Stage advanced',
        timestamp: l.updatedAt.toISOString(),
        refId: l.id,
      })
    }
  }

  for (const e of estimates) {
    items.push({
      type: 'estimate_created',
      label: `Estimate ${e.status === 'accepted' ? 'accepted' : 'sent'}: ${e.property}`,
      detail: `${e.product} · $${Math.round(Number(e.price)).toLocaleString()}`,
      timestamp: e.createdAt.toISOString(),
      refId: e.id,
    })
  }

  for (const j of jobs) {
    items.push({
      type: 'job_created',
      label: `Job created: ${j.property}`,
      detail: `$${Math.round(Number(j.contractValue)).toLocaleString()} contract`,
      timestamp: j.createdAt.toISOString(),
      refId: j.id,
    })
    if (j.status === 'completed' && j.completedAt) {
      items.push({
        type: 'job_completed',
        label: `Job completed: ${j.property}`,
        detail: `$${Math.round(Number(j.contractValue)).toLocaleString()} contract value`,
        timestamp: j.completedAt.toISOString(),
        refId: j.id,
      })
    }
  }

  for (const r of inspections) {
    items.push({
      type: 'inspection',
      label: `AI inspection: ${r.windCount + r.hailCount + r.missingCount} findings`,
      detail: `${r.windCount} wind · ${r.hailCount} hail · ${r.missingCount} missing`,
      timestamp: r.createdAt.toISOString(),
      refId: r.id,
    })
  }

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit)
}

/**
 * Build a 6-month rolling revenue + margin trend from completed/in-progress jobs.
 */
async function buildRevenueTrend(): Promise<Array<{ month: string, revenue: number, cost: number, margin: number, jobCount: number }>> {
  const jobs = await db.job.findMany({
    select: { contractValue: true, actualCost: true, cashCollected: true, createdAt: true, completedAt: true, status: true },
  })

  const now = new Date()
  const months: Array<{ key: string, label: string, revenue: number, cost: number, jobCount: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short' })
    months.push({ key, label, revenue: 0, cost: 0, jobCount: 0 })
  }

  for (const j of jobs) {
    // Use completedAt if available, otherwise createdAt, to bucket the job
    const bucketDate = j.completedAt || j.createdAt
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`
    const m = months.find(x => x.key === key)
    if (m) {
      m.revenue += Number(j.contractValue || 0)
      m.cost += Number(j.actualCost || 0)
      m.jobCount += 1
    }
  }

  return months.map(m => ({
    month: m.label,
    revenue: Math.round(m.revenue),
    cost: Math.round(m.cost),
    margin: m.revenue > 0 ? Number((((m.revenue - m.cost) / m.revenue) * 100).toFixed(1)) : 0,
    jobCount: m.jobCount,
  }))
}

/**
 * Build 6-month trend arrays for each KPI sparkline.
 * Returns arrays of plain numbers (one per month, oldest → newest) for:
 * - leads captured per month (by createdAt)
 * - contracts signed per month (leads reaching contracted/job_open/job_complete, by updatedAt)
 * - estimates sent per month (by createdAt)
 * - revenue per month (same as revenueTrend.revenue, for the Contract Value card)
 */
async function buildKpiTrends(): Promise<{
  leads: number[]
  contracted: number[]
  pending: number[]
  revenue: number[]
}> {
  const now = new Date()
  const monthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const [leads, estimates, jobs] = await Promise.all([
    db.lead.findMany({ select: { createdAt: true, updatedAt: true, stage: true } }),
    db.estimate.findMany({ select: { createdAt: true, status: true } }),
    db.job.findMany({ select: { contractValue: true, createdAt: true, completedAt: true } }),
  ])

  const bucketOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  // Leads captured per month
  const leadsPerMonth = new Map<string, number>()
  for (const l of leads) {
    const k = bucketOf(l.createdAt)
    leadsPerMonth.set(k, (leadsPerMonth.get(k) || 0) + 1)
  }

  // Contracts signed per month — count leads whose stage indicates a signed contract,
  // bucketed by updatedAt (the moment they advanced to contracted)
  const contractedPerMonth = new Map<string, number>()
  for (const l of leads) {
    if (['contracted', 'job_open', 'job_complete'].includes(l.stage)) {
      const k = bucketOf(l.updatedAt)
      contractedPerMonth.set(k, (contractedPerMonth.get(k) || 0) + 1)
    }
  }

  // Estimates sent per month
  const estimatesPerMonth = new Map<string, number>()
  for (const e of estimates) {
    const k = bucketOf(e.createdAt)
    estimatesPerMonth.set(k, (estimatesPerMonth.get(k) || 0) + 1)
  }

  // Revenue per month
  const revenuePerMonth = new Map<string, number>()
  for (const j of jobs) {
    const bucketDate = j.completedAt || j.createdAt
    const k = bucketOf(bucketDate)
    revenuePerMonth.set(k, (revenuePerMonth.get(k) || 0) + Number(j.contractValue || 0))
  }

  return {
    leads: monthKeys.map(k => leadsPerMonth.get(k) || 0),
    contracted: monthKeys.map(k => contractedPerMonth.get(k) || 0),
    pending: monthKeys.map(k => estimatesPerMonth.get(k) || 0),
    revenue: monthKeys.map(k => Math.round(revenuePerMonth.get(k) || 0)),
  }
}

/**
 * Build a list of "stale" leads — leads that have been in their current stage
 * longer than a threshold (default 7 days) and are in an active stage.
 * Surfaces pipeline items needing attention.
 */
async function buildStaleLeads(thresholdDays = 7): Promise<Array<{
  id: string
  street: string
  name: string
  stage: string
  nextAction: string
  daysInStage: number
  updatedAt: string
}>> {
  const leads = await db.lead.findMany({
    where: {
      stage: { notIn: ['job_complete', 'lost', 'do_not_contact', 'future'] },
    },
    select: { id: true, street: true, name: true, stage: true, nextAction: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  })

  const now = Date.now()
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000

  return leads
    .map(l => {
      const daysInStage = Math.floor((now - l.updatedAt.getTime()) / (24 * 60 * 60 * 1000))
      return {
        id: l.id,
        street: l.street,
        name: l.name,
        stage: l.stage,
        nextAction: l.nextAction,
        daysInStage,
        updatedAt: l.updatedAt.toISOString(),
      }
    })
    .filter(l => l.daysInStage >= thresholdDays)
    .sort((a, b) => b.daysInStage - a.daysInStage)
    .slice(0, 6)
}

/**
 * Build per-territory quick-stats: leads + contracted + revenue + jobs per territory.
 * Used by the dashboard's territory breakdown card.
 */
async function buildTerritoryStats(): Promise<Array<{
  territory: string
  leads: number
  contracted: number
  revenue: number
  jobs: number
}>> {
  const [leadGroups, jobs] = await Promise.all([
    db.lead.groupBy({
      by: ['territory'],
      _count: true,
      where: { territory: { not: '' } },
    }),
    db.job.findMany({
      select: { contractValue: true, property: true },
    }),
  ])

  // Count contracted leads per territory
  const contractedGroups = await db.lead.groupBy({
    by: ['territory'],
    _count: true,
    where: {
      territory: { not: '' },
      stage: { in: ['contracted', 'job_open', 'job_complete'] },
    },
  })

  const contractedMap = new Map<string, number>()
  for (const g of contractedGroups) {
    contractedMap.set(g.territory, g._count)
  }

  // Revenue per territory — we don't store territory on jobs, so we approximate by
  // matching job.property to lead.street. This is a best-effort join.
  const leads = await db.lead.findMany({ select: { street: true, territory: true } })
  const streetToTerritory = new Map<string, string>()
  for (const l of leads) {
    if (l.territory) streetToTerritory.set(l.street.toLowerCase(), l.territory)
  }

  const revenueMap = new Map<string, number>()
  const jobCountMap = new Map<string, number>()
  for (const j of jobs) {
    // Try to extract the street portion of the job property (before the first comma)
    const streetPart = j.property.split(',')[0].trim().toLowerCase()
    const territory = streetToTerritory.get(streetPart) || 'Unknown'
    revenueMap.set(territory, (revenueMap.get(territory) || 0) + Number(j.contractValue || 0))
    jobCountMap.set(territory, (jobCountMap.get(territory) || 0) + 1)
  }

  const allTerritories = new Set<string>()
  for (const g of leadGroups) allTerritories.add(g.territory)
  for (const t of revenueMap.keys()) allTerritories.add(t)

  return Array.from(allTerritories).map(territory => ({
    territory,
    leads: leadGroups.find(g => g.territory === territory)?._count || 0,
    contracted: contractedMap.get(territory) || 0,
    revenue: Math.round(revenueMap.get(territory) || 0),
    jobs: jobCountMap.get(territory) || 0,
  })).sort((a, b) => b.leads - a.leads || b.revenue - a.revenue)
}

export async function GET(_req: NextRequest) {
  try {
    const [
      totalLeads,
      contractedLeads,
      pendingEstimates,
      activeJobs,
      allJobs,
      stageGroups,
      recentActivity,
      revenueTrend,
      kpiTrends,
      staleLeads,
      territoryStats,
    ] = await Promise.all([
      db.lead.count(),
      db.lead.count({
        where: { stage: { in: ['contracted', 'job_open', 'job_complete'] } }
      }),
      db.estimate.count({ where: { status: { not: 'accepted' } } }),
      db.job.count({ where: { status: { not: 'completed' } } }),
      db.job.findMany({ select: { contractValue: true, actualCost: true, cashCollected: true } }),
      db.lead.groupBy({ by: ['stage'], _count: true }),
      buildRecentActivity(8),
      buildRevenueTrend(),
      buildKpiTrends(),
      buildStaleLeads(),
      buildTerritoryStats(),
    ])

    const totalRevenue = allJobs.reduce((sum, j) => sum + Number(j.contractValue || 0), 0)
    const totalCashCollected = allJobs.reduce((sum, j) => sum + Number(j.cashCollected || 0), 0)

    const marginJobs = allJobs.filter(j => Number(j.contractValue) > 0)
    let avgMarginPct = 0
    if (marginJobs.length > 0) {
      const sum = marginJobs.reduce(
        (acc, j) => acc + ((Number(j.contractValue) - Number(j.actualCost || 0)) / Number(j.contractValue)) * 100,
        0
      )
      avgMarginPct = Number((sum / marginJobs.length).toFixed(1))
    }

    const stageCounts: Record<string, number> = {}
    for (const s of LEAD_STAGES) {
      stageCounts[s] = 0
    }
    for (const g of stageGroups) {
      if (stageCounts[g.stage] !== undefined) {
        stageCounts[g.stage] = g._count
      }
    }

    return NextResponse.json({
      totalLeads,
      contractedLeads,
      pendingEstimates,
      activeJobs,
      totalRevenue,
      totalCashCollected,
      avgMarginPct,
      stageCounts,
      recentActivity,
      revenueTrend,
      kpiTrends,
      staleLeads,
      territoryStats,
    })
  } catch (err) {
    console.error('GET /api/metrics failed', err)
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 })
  }
}
