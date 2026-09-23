import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
export async function GET(req: NextRequest) {
  try {
    const leadId = req.nextUrl.searchParams.get('leadId')
    const [photos, inspections] = await Promise.all([
      db.photoAsset.findMany({ where: leadId ? { leadId } : undefined, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.inspectionReport.findMany({ where: leadId ? { leadId } : undefined, orderBy: { createdAt: 'desc' }, take: 100, include: { lead: { select: { street: true, city: true, state: true, zip: true } } } }),
    ])
    const inspectionPhotos = inspections.map(r => ({ id: `inspection-${r.id}`, leadId: r.leadId, address: r.lead ? [r.lead.street, r.lead.city, r.lead.state, r.lead.zip].filter(Boolean).join(', ') : 'Unattached photo', title: `AI Inspection · ${r.windCount + r.hailCount + r.missingCount} findings`, category: 'ai-inspection', dataUrl: r.photoDataUrl, createdAt: r.createdAt }))
    return NextResponse.json({ photos: [...photos, ...inspectionPhotos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) })
  } catch (err) { console.error('GET /api/photo-bank failed', err); return NextResponse.json({ error: 'Failed to load photo bank' }, { status: 500 }) }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); const dataUrl = String(body?.dataUrl || ''); const address = String(body?.address || '').trim()
    if (!dataUrl.startsWith('data:image/')) return NextResponse.json({ error: 'A valid image is required' }, { status: 400 })
    if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })
    if (dataUrl.length > 3_500_000) return NextResponse.json({ error: 'Photo is too large. Use a smaller image.' }, { status: 413 })
    const session = await getSession()
    const photo = await db.photoAsset.create({ data: { leadId: body?.leadId ? String(body.leadId) : null, address, title: String(body?.title || 'Roof photo'), category: String(body?.category || 'roof'), dataUrl, createdById: session?.employeeId || null } })
    return NextResponse.json({ photo }, { status: 201 })
  } catch (err) { console.error('POST /api/photo-bank failed', err); return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 }) }
}
