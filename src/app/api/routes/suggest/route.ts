import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null
async function getZai() {
  if (!_zai) _zai = await ZAI.create()
  return _zai
}

/**
 * POST /api/routes/suggest
 * Uses AI + historical data (past 6 months) to recommend the best target
 * canvass routes based on lead conversion patterns, territory performance,
 * and stage distribution.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { town } = body || {}

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [leads, estimates, jobs, routes, aerialScans] = await Promise.all([
      db.lead.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { id: true, street: true, city: true, state: true, zip: true, territory: true, source: true, stage: true, createdAt: true, updatedAt: true },
      }),
      db.estimate.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { id: true, property: true, price: true, status: true, createdAt: true },
      }),
      db.job.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { id: true, property: true, contractValue: true, status: true, createdAt: true, completedAt: true },
      }),
      db.canvassRoute.findMany({
        include: { stops: { select: { street: true, status: true, visitedAt: true } } },
      }),
      db.aerialScan.findMany({
        orderBy: { scannedAt: 'desc' },
        select: { id: true, leadId: true, address: true, conditionScore: true, condition: true, findings: true, scannedAt: true },
      }),
    ])

    const totalLeads = leads.length
    const contractedLeads = leads.filter(l => ['contracted', 'job_open', 'job_complete'].includes(l.stage)).length
    const totalRevenue = jobs.reduce((s, j) => s + Number(j.contractValue || 0), 0)
    const completedRoutes = routes.filter(r => r.status === 'completed')
    const totalStopsVisited = completedRoutes.reduce((s, r) => s + r.stops.filter(st => st.status === 'visited').length, 0)

    // Aerial scan analytics — keep only latest scan per lead
    const latestScans = new Map<string, typeof aerialScans[0]>()
    for (const scan of aerialScans) {
      if (scan.leadId && !latestScans.has(scan.leadId)) {
        latestScans.set(scan.leadId, scan)
      }
    }
    const poorRoofs = Array.from(latestScans.values()).filter(s => s.condition === 'poor')
    const fairRoofs = Array.from(latestScans.values()).filter(s => s.condition === 'fair')
    const goodRoofs = Array.from(latestScans.values()).filter(s => s.condition === 'good')
    const totalScanned = latestScans.size

    const territoryStats: Record<string, { leads: number; contracted: number }> = {}
    for (const l of leads) {
      const t = l.territory || 'Unknown'
      if (!territoryStats[t]) territoryStats[t] = { leads: 0, contracted: 0 }
      territoryStats[t].leads++
      if (['contracted', 'job_open', 'job_complete'].includes(l.stage)) territoryStats[t].contracted++
    }

    const sourceStats: Record<string, number> = {}
    for (const l of leads) {
      const s = l.source || 'door_knock'
      sourceStats[s] = (sourceStats[s] || 0) + 1
    }

    const stageStats: Record<string, number> = {}
    for (const l of leads) {
      stageStats[l.stage] = (stageStats[l.stage] || 0) + 1
    }

    const roadConcentration: Record<string, number> = {}
    for (const l of leads) {
      const road = l.street.replace(/^\d+\s*/, '').trim()
      if (road) roadConcentration[road] = (roadConcentration[road] || 0) + 1
    }
    const topRoads = Object.entries(roadConcentration).sort((a, b) => b[1] - a[1]).slice(0, 10)

    const systemPrompt = `You are an expert roofing canvass route planner for True North Restorations, an Ohio residential roofing contractor. Your job is to recommend the best door-to-door canvass routes based on historical data.

Analyze the provided data and recommend 1-3 specific canvass routes. For each route, provide:
1. A route name
2. Which town/quadrant to target
3. Which specific roads to focus on
4. Why this route is recommended (based on the data)
5. Estimated number of doors to knock

Focus on:
- Roads/territories with high lead concentration but low conversion (untapped potential)
- Areas near existing contracted jobs (referral potential)
- Roads with storm damage history (insurance claim opportunities)
- Time of year considerations (storm season, pre-winter)
- Avoiding areas that are already saturated or have do_not_contact leads

Format your response in clear markdown with headings and bullet points.`

    const dataSummary = `HISTORICAL DATA (Past 6 Months):
- Total leads: ${totalLeads}
- Contracted leads: ${contractedLeads} (${totalLeads > 0 ? Math.round(contractedLeads / totalLeads * 100) : 0}% conversion)
- Total revenue: $${Math.round(totalRevenue).toLocaleString()}
- Completed canvass routes: ${completedRoutes.length}
- Total doors visited: ${totalStopsVisited}

TERRITORY BREAKDOWN:
${Object.entries(territoryStats).map(([t, s]) => `- ${t}: ${s.leads} leads, ${s.contracted} contracted (${s.leads > 0 ? Math.round(s.contracted / s.leads * 100) : 0}% conversion)`).join('\n')}

LEAD SOURCES:
${Object.entries(sourceStats).map(([s, c]) => `- ${s}: ${c}`).join('\n')}

STAGE DISTRIBUTION:
${Object.entries(stageStats).map(([s, c]) => `- ${s}: ${c}`).join('\n')}

TOP ROADS BY LEAD CONCENTRATION:
${topRoads.map(([r, c]) => `- ${r}: ${c} leads`).join('\n')}

${town ? `TARGET TOWN: ${town}` : 'No specific town requested — recommend across all territories.'}

AERIAL ROOF SCAN RESULTS (${totalScanned} roofs scanned):
- Poor condition (priority targets): ${poorRoofs.length}
- Fair condition: ${fairRoofs.length}
- Good condition: ${goodRoofs.length}
${poorRoofs.length > 0 ? `\nPOOR CONDITION ROOFS (hit these doors first):\n${poorRoofs.slice(0, 10).map(s => `- ${s.address} — Score ${s.conditionScore}/10: ${s.findings}`).join('\n')}` : ''}
${fairRoofs.length > 0 ? `\nFAIR CONDITION ROOFS:\n${fairRoofs.slice(0, 5).map(s => `- ${s.address} — Score ${s.conditionScore}/10: ${s.findings}`).join('\n')}` : ''}

EXISTING LEADS (for reference):
${leads.slice(0, 20).map(l => `- ${l.street}, ${l.city} — ${l.stage} (${l.source})`).join('\n')}`

    const zai = await getZai()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: `${dataSummary}\n\nBased on this data, recommend the best canvass routes to target. Be specific about roads and quadrants.` },
      ],
      thinking: { type: 'disabled' },
    })

    const suggestion = completion.choices[0]?.message?.content || 'Unable to generate suggestions.'

    return NextResponse.json({ suggestion, stats: { totalLeads, contractedLeads, totalRevenue, completedRoutes: completedRoutes.length, totalStopsVisited } })
  } catch (err) {
    console.error('POST /api/routes/suggest failed', err)
    return NextResponse.json({ error: 'Failed to generate route suggestions' }, { status: 500 })
  }
}
