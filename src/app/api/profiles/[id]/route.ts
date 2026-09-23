import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const profile = await db.pricingProfile.findUnique({ where: { id } })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    if (profile.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default profile' },
        { status: 400 }
      )
    }
    await db.pricingProfile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/profiles/[id] failed', err)
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
  }
}
