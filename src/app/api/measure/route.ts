import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { area, pitch } = body || {}

    const areaNum = Number(area)
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      return NextResponse.json(
        { error: 'area must be a positive number' },
        { status: 400 }
      )
    }

    const pitchNum = Number(pitch ?? 0) || 0
    const pitchFactor = Math.sqrt(1 + Math.pow(pitchNum / 12, 2))
    const finalArea = Math.round(areaNum * pitchFactor)
    const squares = finalArea / 100

    return NextResponse.json({ pitchFactor, finalArea, squares })
  } catch (err) {
    console.error('POST /api/measure failed', err)
    return NextResponse.json({ error: 'Failed to compute measurement' }, { status: 500 })
  }
}
