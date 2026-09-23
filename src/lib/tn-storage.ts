// True North Field OS — Server-side data access helpers
import { db } from '@/lib/db'
import type { PricingProfile, SupplierPrice } from '@prisma/client'

export interface IkoProduct {
  id: string
  name: string
  shortName: string
  warranty: string
  exposure: string
  classRating: string
  windRating: string
  colors: string[]
  description: string
}

// Official IKO shingle catalog — Central Ohio field spec
export const IKO_CATALOG: IkoProduct[] = [
  {
    id: 'iko_dynasty',
    name: 'IKO Dynasty (Performance Architectural)',
    shortName: 'Dynasty',
    warranty: 'Limited Lifetime / Class 3 Impact',
    exposure: '5-7/8 in',
    classRating: 'Class 3 Impact',
    windRating: '130 MPH',
    colors: ['Glacier', 'Castle Grey', 'Appalachian', 'Brownstone', 'Emerald Green', 'Shadow Brown', 'Monaco Red', 'Cornerstone'],
    description: 'Performance architectural shingle with ArmourZone. Engineered for Ohio storm resistance and high-wind warranty up to 130 MPH.'
  },
  {
    id: 'iko_cambridge',
    name: 'IKO Cambridge (Architectural)',
    shortName: 'Cambridge',
    warranty: 'Limited Lifetime / Class A Fire',
    exposure: '5-7/8 in',
    classRating: 'Class A Fire',
    windRating: '110 MPH',
    colors: ['Dual Black', 'Charcoal Grey', 'Weatherwood', 'Harvard Slate', 'Driftwood', 'Earthtone Cedar'],
    description: 'Value architectural laminated shingle with heavy mat. Proven Ohio performer for residential re-roof projects.'
  },
  {
    id: 'iko_nordic',
    name: 'IKO Nordic (High Performance / Class 4)',
    shortName: 'Nordic',
    warranty: 'Limited Lifetime / Class 4 Impact',
    exposure: '5-7/8 in',
    classRating: 'Class 4 Impact',
    windRating: '130 MPH',
    colors: ['Granite Black', 'Mohegan Blend', 'Frosted Slate', 'Sedona'],
    description: 'Class 4 impact-resistant shingle. Insurance-premium friendly for hail-prone Central Ohio territories.'
  }
]

export const DEFAULT_PROFILES: Omit<PricingProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'IKO Dynasty — Standard 2026',
    materialPerSq: 135.00,
    laborPerSq: 85.00,
    tearOffPerSq: 35.00,
    underlaymentPerSq: 22.00,
    accessoriesPerSq: 28.00,
    disposalPerJob: 450.00,
    permitPerJob: 200.00,
    salesCommissionPct: 10,
    targetGrossMarginPct: 35,
    isDefault: true
  },
  {
    name: 'IKO Cambridge — Value 2026',
    materialPerSq: 110.00,
    laborPerSq: 80.00,
    tearOffPerSq: 35.00,
    underlaymentPerSq: 20.00,
    accessoriesPerSq: 24.00,
    disposalPerJob: 400.00,
    permitPerJob: 175.00,
    salesCommissionPct: 10,
    targetGrossMarginPct: 35,
    isDefault: false
  },
  {
    name: 'IKO Nordic — Storm Premium 2026',
    materialPerSq: 168.00,
    laborPerSq: 92.00,
    tearOffPerSq: 38.00,
    underlaymentPerSq: 24.00,
    accessoriesPerSq: 30.00,
    disposalPerJob: 475.00,
    permitPerJob: 200.00,
    salesCommissionPct: 10,
    targetGrossMarginPct: 38,
    isDefault: false
  }
]

export const LEAD_STAGES = [
  'new',
  'contacted',
  'inspection_set',
  'inspection_complete',
  'estimate_sent',
  'follow_up',
  'contracted',
  'job_open',
  'job_complete',
  'lost',
  'future',
  'do_not_contact'
] as const

export type LeadStage = typeof LEAD_STAGES[number]

// Seed default pricing profiles if the table is empty.
export async function ensureSeedData() {
  const count = await db.pricingProfile.count()
  if (count === 0) {
    await db.pricingProfile.createMany({ data: DEFAULT_PROFILES })
  }
}

// Get the best (most recent) verified supplier price for a product/color combo.
export async function getVerifiedSupplierPrice(productId: string, color: string): Promise<SupplierPrice | null> {
  const prices = await db.supplierPrice.findMany({
    where: {
      product: productId,
      OR: [{ color: '' }, { color }]
    },
    orderBy: { savedAt: 'desc' }
  })
  // Prefer exact color match, then fall back to "All Colors" entries
  return (
    prices.find(p => p.color === color) ||
    prices.find(p => p.color === '') ||
    prices[0] ||
    null
  )
}
