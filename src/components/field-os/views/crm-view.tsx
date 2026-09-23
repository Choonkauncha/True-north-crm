'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, CalendarX2, CheckCircle2, Clock3, Search, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPatch, apiPost, fmtDateTime, stageBadgeClasses, stageLabel, type Appointment, type CrmRecord } from '@/lib/tn-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function CrmView({ openLeadId, onOpenConsumed }: { openLeadId?: string | null; onOpenConsumed?: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CrmRecord | null>(null)
  const [status, setStatus] = useState<'yes' | 'no'>('no')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [notes, setNotes] = useState('')

  const q = useQuery({ queryKey: ['crm'], queryFn: () => apiGet<{ records: CrmRecord[] }>('/api/crm') })
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a CRM record first')
      const existing = selected.latestAppointment
      const payload = { status, appointmentDate: appointmentDate || null, notes }
      if (existing) return apiPatch<{ appointment: Appointment }>(`/api/appointments/${existing.id}`, payload)
      return apiPost<{ appointment: Appointment }>('/api/appointments', { leadId: selected.id, ...payload })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm'] }); setSelected(null); toast.success('Appointment record saved') },
    onError: (e: Error) => toast.error('Could not save CRM record', { description: e.message }),
  })

  const open = (r: CrmRecord) => {
    setSelected(r)
    const a = r.latestAppointment
    setStatus(a?.status === 'yes' ? 'yes' : 'no')
    setAppointmentDate(a?.appointmentDate ? new Date(a.appointmentDate).toISOString().slice(0, 16) : '')
    setNotes(a?.notes || '')
  }

  const records = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return q.data?.records || []
    return (q.data?.records || []).filter(r => [r.street, r.city, r.state, r.zip, r.name, r.phone, r.email].some(v => String(v || '').toLowerCase().includes(term)))
  }, [q.data?.records, search])

  useEffect(() => {
    if (!openLeadId || !records.length) return
    const record = records.find(r => r.id === openLeadId)
    if (record) { open(record); onOpenConsumed?.() }
  }, [openLeadId, records])



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#071321]">Address CRM</h2>
          <p className="text-sm text-slate-500">One record per property. Set or decline appointments and keep the call notes attached to that address.</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, or address" className="pl-9" />
        </div>
      </div>

      {q.isLoading ? <Card><CardContent className="py-12 text-center text-sm text-slate-500">Loading CRM…</CardContent></Card> : null}
      {q.isError ? <Card className="border-red-200"><CardContent className="py-12 text-center text-sm text-red-600">Failed to load CRM records.</CardContent></Card> : null}
      {!q.isLoading && records.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-slate-500">No address records match your search.</CardContent></Card> : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {records.map(r => {
          const appt = r.latestAppointment
          const address = [r.street, r.city, r.state, r.zip].filter(Boolean).join(', ')
          return (
            <Card key={r.id} className="border-[#d6e2ee] hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-sm truncate flex items-center gap-2"><UserRound className="size-4 text-[#0084ff]" /> {r.name || 'Homeowner / Unknown'}</CardTitle>
                    <div className="text-xs text-slate-500 mt-1 break-words">{address}</div>
                  </div>
                  <Badge variant="outline" className={stageBadgeClasses(r.stage)}>{stageLabel(r.stage)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#e5edf5] p-2"><span className="text-slate-400">Phone</span><div className="font-semibold text-[#071321] mt-0.5">{r.phone || '—'}</div></div>
                  <div className="rounded-lg border border-[#e5edf5] p-2"><span className="text-slate-400">Email</span><div className="font-semibold text-[#071321] mt-0.5 truncate">{r.email || '—'}</div></div>
                </div>
                <div className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] p-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {appt?.status === 'yes' ? <CalendarCheck2 className="size-4 text-emerald-600" /> : <CalendarX2 className="size-4 text-slate-400" />}
                    <div><div className="text-xs font-semibold text-[#071321]">Appointment: {appt?.status === 'yes' ? 'YES' : 'NO'}</div><div className="text-[11px] text-slate-500">{appt?.appointmentDate ? fmtDateTime(appt.appointmentDate) : 'No date recorded'}</div></div>
                  </div>
                  <Button size="sm" onClick={() => open(r)} className="bg-[#0084ff] hover:bg-[#0070e0] text-white">Open CRM</Button>
                </div>
                {appt?.notes ? <div className="text-xs text-slate-600 line-clamp-2"><span className="font-semibold text-[#071321]">Last note:</span> {appt.notes}</div> : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>CRM · {selected?.street}</DialogTitle>
            <DialogDescription>{selected ? [selected.street, selected.city, selected.state, selected.zip].filter(Boolean).join(', ') : ''}</DialogDescription>
          </DialogHeader>
          {selected && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={status === 'yes' ? 'default' : 'outline'} onClick={() => setStatus('yes')} className={status === 'yes' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}><CheckCircle2 className="size-4" /> Appointment YES</Button>
              <Button type="button" variant={status === 'no' ? 'default' : 'outline'} onClick={() => setStatus('no')} className={status === 'no' ? 'bg-slate-700 hover:bg-slate-800' : ''}><CalendarX2 className="size-4" /> Appointment NO</Button>
            </div>
            {status === 'yes' && <div className="space-y-1.5"><Label htmlFor="crm-date">Appointment date / time</Label><Input id="crm-date" type="datetime-local" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /></div>}
            <div className="space-y-1.5"><Label htmlFor="crm-notes">Call / appointment notes</Label><Textarea id="crm-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Homeowner spoke with setter. Wants inspection after 5 PM. Note dogs, gate, contact preference, storm timing, etc." /></div>
            {selected.notes && <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900"><span className="font-semibold">Pipeline notes:</span> {selected.notes}</div>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-[#0084ff] hover:bg-[#0070e0] text-white">{saveMut.isPending ? 'Saving…' : 'Save CRM Record'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
