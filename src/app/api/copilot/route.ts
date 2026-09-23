import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runCopilot } from '@/lib/ai'
import type { CopilotTurn } from '@/lib/ai'

/**
 * Build a concise live-business-state string for the Copilot system prompt.
 * Keeps token usage modest while letting the Copilot reference real numbers.
 */
async function buildBusinessContext(): Promise<string> {
  const [leads, estimates, jobs] = await Promise.all([
    db.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, street: true, name: true, stage: true, nextAction: true, verifiedArea: true, createdAt: true } }),
    db.estimate.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, property: true, product: true, price: true, status: true, createdAt: true } }),
    db.job.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, property: true, contractValue: true, actualCost: true, cashCollected: true, balance: true, status: true, createdAt: true } }),
  ])

  const totalRevenue = jobs.reduce((s, j) => s + Number(j.contractValue || 0), 0)
  const totalCash = jobs.reduce((s, j) => s + Number(j.cashCollected || 0), 0)
  const activeLeads = leads.filter(l => !['lost', 'do_not_contact', 'future', 'job_complete'].includes(l.stage))
  const pendingEstimates = estimates.filter(e => e.status !== 'accepted').length

  const lines: string[] = []
  lines.push(`Pipeline: ${leads.length} total leads (${activeLeads.length} active), ${estimates.length} estimates (${pendingEstimates} pending), ${jobs.length} jobs.`)
  lines.push(`Revenue: $${Math.round(totalRevenue).toLocaleString()} contracted, $${Math.round(totalCash).toLocaleString()} cash collected.`)
  lines.push('')
  lines.push('Recent active leads (newest first):')
  for (const l of activeLeads.slice(0, 6)) {
    const area = l.verifiedArea ? `, ${Math.round(l.verifiedArea)} sqft verified` : ''
    lines.push(`- ${l.street} (${l.stage.replace(/_/g, ' ')}${area}) — next: ${l.nextAction || 'unset'}`)
  }
  if (jobs.length > 0) {
    lines.push('')
    lines.push('Jobs:')
    for (const j of jobs) {
      const margin = Number(j.contractValue) > 0 ? (((Number(j.contractValue) - Number(j.actualCost || 0)) / Number(j.contractValue)) * 100).toFixed(1) : '0'
      lines.push(`- ${j.property}: $${Math.round(Number(j.contractValue)).toLocaleString()} contract, $${Math.round(Number(j.cashCollected)).toLocaleString()} collected, $${Math.round(Number(j.balance)).toLocaleString()} balance, ${j.status} (${margin}% margin)`)
    }
  }
  return lines.join('\n')
}

export async function GET(_req: NextRequest) {
  try {
    const rows = await db.copilotMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 50
    })
    const messages = rows.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt
    }))
    return NextResponse.json({ messages })
  } catch (err) {
    console.error('GET /api/copilot failed', err)
    return NextResponse.json({ error: 'Failed to load copilot messages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, history } = body || {}

    if (!message || String(message).trim() === '') {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const userMsg = String(message)
    const turns: CopilotTurn[] = Array.isArray(history)
      ? history
          .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
          .map((t: any) => ({ role: t.role, content: String(t.content) }))
      : []

    // Inject live business state so the Copilot gives context-aware advice
    const businessContext = await buildBusinessContext()
    const reply = await runCopilot(turns, userMsg, businessContext)

    await db.copilotMessage.create({
      data: { role: 'user', content: userMsg }
    })
    await db.copilotMessage.create({
      data: { role: 'assistant', content: reply }
    })

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('POST /api/copilot failed', err)
    return NextResponse.json({ error: 'Failed to run copilot' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    await db.copilotMessage.deleteMany({})
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/copilot failed', err)
    return NextResponse.json({ error: 'Failed to clear copilot messages' }, { status: 500 })
  }
}
