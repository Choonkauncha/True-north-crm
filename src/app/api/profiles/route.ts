import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureSeedData } from '@/lib/tn-storage'

export async function GET(_req: NextRequest) {
  try {
    await ensureSeedData()
    const profiles = await db.pricingProfile.findMany({ orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ profiles })
  } catch (err) {
    console.error('GET /api/profiles failed', err)
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeedData()
    const body = await req.json()

    const allowed = [
      'name', 'materialPerSq', 'laborPerSq', 'tearOffPerSq',
      'underlaymentPerSq', 'accessoriesPerSq', 'disposalPerJob',
      'permitPerJob', 'salesCommissionPct', 'targetGrossMarginPct', 'isDefault'
    ]

    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key]
      }
    }

    if (!data.name) {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 400 })
    }

    const profile = await db.pricingProfile.create({ data: data as any })
    return NextResponse.json({ profile }, { status: 201 })
  } catch (err) {
    console.error('POST /api/profiles failed', err)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}
