import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { IKO_CATALOG } from '@/lib/tn-storage'

/**
 * GET /api/estimates/:id/detail
 * Returns the full estimate with its linked lead, job, and the matching IKO
 * catalog entry — everything the printable proposal view needs in one call.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const estimate = await db.estimate.findUnique({ where: { id } })
    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const [lead, job] = await Promise.all([
      estimate.leadId ? db.lead.findUnique({ where: { id: estimate.leadId } }) : Promise.resolve(null),
      db.job.findFirst({ where: { estimateId: id } }),
    ])

    const product = IKO_CATALOG.find(p => p.id === estimate.productId) || null

    return NextResponse.json({
      estimate: {
        id: estimate.id,
        leadId: estimate.leadId,
        property: estimate.property,
        product: estimate.product,
        productId: estimate.productId,
        color: estimate.color,
        area: estimate.area,
        squares: estimate.squares,
        wastePct: estimate.wastePct,
        discount: estimate.discount,
        shinglePerSq: estimate.shinglePerSq,
        profileName: estimate.profileName,
        price: estimate.price,
        directCost: estimate.directCost,
        grossProfit: estimate.grossProfit,
        grossMarginPct: estimate.grossMarginPct,
        status: estimate.status,
        createdAt: estimate.createdAt,
      },
      lead: lead ? {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        street: lead.street,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        source: lead.source,
        territory: lead.territory,
        verifiedArea: lead.verifiedArea,
        pitch: lead.pitch,
      } : null,
      job: job ? {
        id: job.id,
        status: job.status,
        contractValue: job.contractValue,
        contractFilename: job.contractFilename,
      } : null,
      product: product ? {
        id: product.id,
        name: product.name,
        shortName: product.shortName,
        warranty: product.warranty,
        exposure: product.exposure,
        classRating: product.classRating,
        windRating: product.windRating,
        description: product.description,
      } : null,
    })
  } catch (err) {
    console.error('GET /api/estimates/:id/detail failed', err)
    return NextResponse.json({ error: 'Failed to load estimate detail' }, { status: 500 })
  }
}
