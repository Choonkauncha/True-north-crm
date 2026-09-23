import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  try {
    const estimates = await db.estimate.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ estimates })
  } catch (err) {
    console.error('GET /api/estimates failed', err)
    return NextResponse.json({ error: 'Failed to load estimates' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      leadId, property, productId, product, color,
      area, squares, wastePct, discount, shinglePerSq,
      profileName, price, directCost, grossProfit, grossMarginPct
    } = body || {}

    if (!property || String(property).trim() === '') {
      return NextResponse.json({ error: 'Property is required' }, { status: 400 })
    }
    if (!productId) {
      return NextResponse.json({ error: 'Product is required' }, { status: 400 })
    }

    const session = await getSession()
    const estimate = await db.estimate.create({
      data: {
        leadId: leadId ? String(leadId) : null,
        property: String(property),
        productId: String(productId),
        product: String(product ?? ''),
        color: String(color ?? ''),
        area: Number(area ?? 0),
        squares: Number(squares ?? 0),
        wastePct: Number(wastePct ?? 12),
        discount: Number(discount ?? 0),
        shinglePerSq: Number(shinglePerSq ?? 0),
        profileName: String(profileName ?? ''),
        price: Number(price ?? 0),
        directCost: Number(directCost ?? 0),
        grossProfit: Number(grossProfit ?? 0),
        grossMarginPct: Number(grossMarginPct ?? 0),
        status: 'sent',
        createdById: session?.employeeId || null,
      }
    })

    if (leadId) {
      try {
        await db.lead.update({
          where: { id: String(leadId) },
          data: {
            stage: 'estimate_sent',
            nextAction: 'Follow up with homeowner on estimate'
          }
        })
      } catch (e) {
        console.error('Failed to update lead stage after estimate creation', e)
      }
    }

    if (session) await db.activityLog.create({ data: { employeeId: session.employeeId, action: 'estimate_created', entityType: 'estimate', entityId: estimate.id, summary: `Created estimate for ${estimate.property}` } })
    return NextResponse.json({ estimate }, { status: 201 })
  } catch (err) {
    console.error('POST /api/estimates failed', err)
    return NextResponse.json({ error: 'Failed to create estimate' }, { status: 500 })
  }
}
