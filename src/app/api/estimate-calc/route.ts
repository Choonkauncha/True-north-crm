import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeedData, getVerifiedSupplierPrice } from '@/lib/tn-storage'

export async function POST(req: NextRequest) {
  try {
    await ensureSeedData()
    const body = await req.json()
    const { area, wastePct, discount, productId, color, profileId } = body || {}

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }
    const areaNum = Number(area)
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      return NextResponse.json(
        { error: 'area must be a positive number' },
        { status: 400 }
      )
    }

    const profile = await db.pricingProfile.findUnique({ where: { id: String(profileId) } })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const supplierPrice = await getVerifiedSupplierPrice(String(productId), String(color ?? ''))
    const shinglePerSq = supplierPrice ? Number(supplierPrice.price) : Number(profile.materialPerSq)

    const wasteNum = Number(wastePct ?? 0) || 0
    const discountNum = Number(discount ?? 0) || 0

    const squares = (areaNum * (1 + wasteNum / 100)) / 100
    const materialCost = squares * shinglePerSq
    const laborCost = squares * Number(profile.laborPerSq)
    const tearOffCost = squares * Number(profile.tearOffPerSq)
    const underlayCost = squares * Number(profile.underlaymentPerSq)
    const accessCost = squares * Number(profile.accessoriesPerSq)
    const fixedCost = Number(profile.disposalPerJob) + Number(profile.permitPerJob)
    const totalDirectCost =
      materialCost + laborCost + tearOffCost + underlayCost + accessCost + fixedCost

    const marginRatio = (Number(profile.targetGrossMarginPct) || 35) / 100
    const rawPrice = totalDirectCost / (1 - marginRatio)
    const finalPrice = Math.max(0, Math.round(rawPrice - discountNum))
    const grossProfit = finalPrice - totalDirectCost
    const actualMarginPct =
      finalPrice > 0 ? Number(((grossProfit / finalPrice) * 100).toFixed(1)) : 0

    return NextResponse.json({
      shinglePerSq,
      squares,
      materialCost,
      laborCost,
      tearOffCost,
      underlayCost,
      accessCost,
      fixedCost,
      totalDirectCost,
      marginRatio,
      rawPrice,
      finalPrice,
      grossProfit,
      actualMarginPct,
      supplierPrice
    })
  } catch (err) {
    console.error('POST /api/estimate-calc failed', err)
    return NextResponse.json({ error: 'Failed to compute estimate' }, { status: 500 })
  }
}
