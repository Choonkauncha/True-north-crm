'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LockKeyhole, ArrowRight, Map, Users, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { UserRole } from '@/lib/tn-api'

const roles: Array<{ value: UserRole; label: string; detail: string; icon: typeof Users }> = [
  { value: 'admin', label: 'Admin', detail: 'Full Field OS, employees, access gates, finance, jobs and controls.', icon: ShieldCheck },
  { value: 'sales', label: 'Sales Rep', detail: 'Leads, CRM, map, photo bank, AI inspection and estimates.', icon: Calculator },
  { value: 'setter', label: 'Appointment Setter', detail: 'CRM and territory navigation only.', icon: Map },
]

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('admin')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, password, employeeId: employeeId || undefined }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Login failed')
      if (data?.needsEmployeeSelection) {
        setEmployees(Array.isArray(data.employees) ? data.employees : [])
        setEmployeeId('')
        toast.info('Choose your employee profile to continue')
        return
      }
      toast.success(`Signed in as ${data.employeeName || data.label}`)
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
      router.refresh()
    } catch (err) {
      toast.error('Access denied', { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const selected = roles.find(r => r.value === role)!
  const RoleIcon = selected.icon

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f5f8fc] via-white to-[#e9f4ff] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-[#d6e2ee] shadow-xl shadow-[#0b2540]/10">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <img src="/true-north-logo.png" alt="True North Restorations" className="size-12 rounded-xl ring-1 ring-[#40d4ff]/30 bg-[#071321]" />
            <div>
              <CardTitle className="text-2xl tracking-tight text-[#071321]">True North Field OS</CardTitle>
              <CardDescription>Role-based roofing operations workspace</CardDescription>
            </div>
          </div>
          <div className="rounded-xl border border-[#d6e2ee] bg-[#f8fbff] p-3 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center"><RoleIcon className="size-4" /></div>
            <div className="min-w-0"><div className="font-semibold text-sm text-[#071321]">{selected.label}</div><div className="text-xs text-slate-500">{selected.detail}</div></div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="role">Access level</Label>
              <Select value={role} onValueChange={(v: UserRole) => setRole(v)}>
                <SelectTrigger id="role" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Access password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="pl-9 h-11" placeholder="Enter access password" />
              </div>
            </div>
            {employees.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="employee">Employee profile</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="employee" className="h-11"><SelectValue placeholder="Select your profile" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.email ? ` · ${e.email}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">The role password opens the gate; the profile records your individual activity.</p>
              </div>
            )}
            <Button type="submit" disabled={busy || (employees.length > 0 && !employeeId)} className="w-full h-11 bg-[#0084ff] hover:bg-[#0070e0] text-white">
              <ArrowRight className="size-4" /> {busy ? 'Signing in…' : 'Enter Field OS'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
