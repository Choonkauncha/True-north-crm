'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, UserRound, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost, type EmployeeProfile, type UserRole } from '@/lib/tn-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const roles: UserRole[] = ['admin', 'sales', 'setter']
const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', sales: 'Sales Rep', setter: 'Appointment Setter' }

export function EmployeesView() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['employees'], queryFn: () => apiGet<{ employees: EmployeeProfile[] }>('/api/employees') })
  const [name, setName] = useState(''); const [role, setRole] = useState<UserRole>('sales'); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [notes, setNotes] = useState('')
  const [gateRole, setGateRole] = useState<UserRole>('sales'); const [newPassword, setNewPassword] = useState('')
  const createMut = useMutation({ mutationFn: () => apiPost('/api/employees', { name, role, email, phone, notes }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setName(''); setEmail(''); setPhone(''); setNotes(''); toast.success('Employee profile created') }, onError: (e: Error) => toast.error('Could not create employee', { description: e.message }) })
  const toggleMut = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => apiPatch(`/api/employees/${id}`, { active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }) })
  const gateMut = useMutation({ mutationFn: () => apiPost('/api/auth/password', { role: gateRole, newPassword }), onSuccess: () => { setNewPassword(''); toast.success(`${ROLE_LABELS[gateRole]} gate password changed`) }, onError: (e: Error) => toast.error('Could not change gate password', { description: e.message }) })

  return (
    <div className="space-y-5">
      <div><h2 className="text-base font-semibold text-[#071321]">Employees & Access</h2><p className="text-sm text-slate-500">Create authenticated employee profiles, track production, and manage the three application gates.</p></div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Plus className="size-4 text-[#0084ff]" /> Add employee profile</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div><div className="space-y-1.5"><Label>Role</Label><Select value={role} onValueChange={(v: UserRole) => setRole(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div></div><div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div><Button disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()} className="bg-[#0084ff] hover:bg-[#0070e0] text-white">Create Profile</Button></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><KeyRound className="size-4 text-amber-500" /> Access gate passwords</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Gate passwords are stored as password hashes. Changing a gate affects the role password used at the main sign-in screen.</div><div className="space-y-1.5"><Label>Gate</Label><Select value={gateRole} onValueChange={(v: UserRole) => setGateRole(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>New password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" /></div><Button disabled={newPassword.length < 8 || gateMut.isPending} onClick={() => gateMut.mutate()} className="bg-[#071321] hover:bg-[#102238] text-white">{gateMut.isPending ? 'Changing…' : 'Change Gate Password'}</Button></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-sm">Employee track record</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{(q.data?.employees || []).map(e => <div key={e.id} className={`rounded-xl border p-4 ${e.active ? 'border-[#d6e2ee] bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="size-10 rounded-full bg-[#071321] text-[#40d4ff] flex items-center justify-center"><UserRound className="size-5" /></div><div><div className="font-semibold text-sm text-[#071321]">{e.name}</div><div className="text-xs text-slate-500">{ROLE_LABELS[e.role]} · {e.email || 'No email'}</div></div></div><Badge variant="outline" className={e.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>{e.active ? 'Active' : 'Inactive'}</Badge></div><div className="grid grid-cols-4 gap-2 mt-4"><Metric label="Leads" value={e.metrics.leads}/><Metric label="Estimates" value={e.metrics.estimates}/><Metric label="Appointments" value={e.metrics.appointments}/><Metric label="Jobs" value={e.metrics.jobs}/></div><div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>Last login: {e.lastLoginAt ? new Date(e.lastLoginAt).toLocaleString() : 'Never'}</span><Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: e.id, active: !e.active })}><UserX className="size-3.5" /> {e.active ? 'Deactivate' : 'Reactivate'}</Button></div></div>)}</div>{q.isLoading && <div className="py-8 text-center text-sm text-slate-500">Loading employee profiles…</div>}</CardContent></Card>
    </div>
  )
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] p-2 text-center"><div className="text-lg font-bold text-[#071321]">{value}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div></div> }
