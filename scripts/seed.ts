// One-off seed: inserts default pricing profiles if none exist.
import { PrismaClient } from '@prisma/client'
import { DEFAULT_PROFILES } from '../src/lib/tn-storage'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.pricingProfile.count()
  if (count === 0) {
    await prisma.pricingProfile.createMany({ data: DEFAULT_PROFILES })
    console.log(`Seeded ${DEFAULT_PROFILES.length} default pricing profiles`)
  } else {
    console.log(`Pricing profiles already exist (${count}), skipping seed`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
