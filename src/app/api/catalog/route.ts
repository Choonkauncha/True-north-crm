import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { IKO_CATALOG, ensureSeedData } from '@/lib/tn-storage'

export async function GET(_req: NextRequest) {
  try {
    await ensureSeedData()
    const profiles = await db.pricingProfile.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ catalog: IKO_CATALOG, profiles })
  } catch (err) {
    console.error('GET /api/catalog failed', err)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}
