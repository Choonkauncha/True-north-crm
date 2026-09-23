import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  try {
    const prices = await db.supplierPrice.findMany({ orderBy: { savedAt: 'desc' } })
    return NextResponse.json({ prices })
  } catch (err) {
    console.error('GET /api/prices failed', err)
    return NextResponse.json({ error: 'Failed to load prices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { product, color, price, supplier, item } = body || {}

    if (!product || String(product).trim() === '') {
      return NextResponse.json({ error: 'product is required' }, { status: 400 })
    }
    if (price === undefined || price === null) {
      return NextResponse.json({ error: 'price is required' }, { status: 400 })
    }

    const colorStr = String(color ?? '')
    const existing = await db.supplierPrice.findFirst({
      where: { product: String(product), color: colorStr }
    })

    let saved
    if (existing) {
      saved = await db.supplierPrice.update({
        where: { id: existing.id },
        data: {
          price: Number(price),
          supplier: String(supplier ?? existing.supplier),
          item: String(item ?? existing.item),
          savedAt: new Date()
        }
      })
    } else {
      saved = await db.supplierPrice.create({
        data: {
          product: String(product),
          color: colorStr,
          price: Number(price),
          supplier: String(supplier ?? ''),
          item: String(item ?? '')
        }
      })
    }

    return NextResponse.json({ price: saved }, { status: 201 })
  } catch (err) {
    console.error('POST /api/prices failed', err)
    return NextResponse.json({ error: 'Failed to save price' }, { status: 500 })
  }
}
