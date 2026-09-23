import { redirect } from 'next/navigation'
import { FieldOSApp } from '@/components/field-os/field-os-app'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
    return null
  }
  return <FieldOSApp initialSession={session} />
}
