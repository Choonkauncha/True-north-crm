'use client'

// This view synchronizes an external openLeadId prop (from the dashboard stale-leads
// callout) into local dialog state via an effect. Disable the strict set-state-in-effect
// rule for the whole file — this pattern is intentional and bounded.
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Upload,
  Users,
  Filter,
  Search,
  Trash2,
  Ruler,
  Save,
  X,
  Camera,
  FileText,
  Hammer,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  fmtDate,
  fmtDateTime,
  stageBadgeClasses,
  stageLabel,
  LEAD_STAGES,
  type Lead,
  type LeadStage,
} from '@/lib/tn-api'
import type { MeasurePrefill } from '@/components/field-os/views/measure-view'

interface TimelineEvent {
  type: 'lead_created' | 'stage_advanced' | 'inspection' | 'estimate' | 'job'
  title: string
  detail: string
  timestamp: string
}

const SOURCE_OPTIONS = [
  { value: 'door_knock', label: 'Door Knock' },
  { value: 'referral', label: 'Referral' },
  { value: 'storm_canvas', label: 'Storm Canvas' },
  { value: 'online', label: 'Online / Web' },
  { value: 'sign_call', label: 'Yard Sign Call' },
  { value: 'insurance', label: 'Insurance Referral' },
]

const TERRITORY_OPTIONS = [
  { value: 'Knox County', label: 'Knox County' },
  { value: 'Licking County', label: 'Licking County' },
  { value: 'Delaware County', label: 'Delaware County' },
  { value: 'Franklin County', label: 'Franklin County' },
  { value: 'Coshocton County', label: 'Coshocton County' },
  { value: 'Holmes County', label: 'Holmes County' },
]

interface LeadsViewProps {
  onMeasureLead: (prefill: MeasurePrefill) => void
  openLeadId?: string | null
  onOpenLeadConsumed?: () => void
}

export function LeadsView({ onMeasureLead, openLeadId, onOpenLeadConsumed }: LeadsViewProps) {
  const qc = useQueryClient()
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [territoryFilter, setTerritoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads'),
  })

  // When an openLeadId is passed (e.g. from the dashboard stale-leads callout),
  // find the lead in the fetched list and open its detail dialog once.
  useEffect(() => {
    if (!openLeadId) return
    const lead = leadsQ.data?.leads.find(l => l.id === openLeadId)
    if (lead) {
      setDetailLead(lead)
      onOpenLeadConsumed?.()
    }
  }, [openLeadId, leadsQ.data, onOpenLeadConsumed])

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/leads', body),
    onSuccess: () => {
      toast.success('Lead created', { description: 'New lead added to the pipeline.' })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      setNewOpen(false)
    },
    onError: (e: Error) => toast.error('Failed to create lead', { description: e.message }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/api/leads/${id}`, body),
    onSuccess: (_data, vars) => {
      toast.success('Lead updated')
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      if (vars.body.verifiedArea !== undefined) {
        qc.invalidateQueries({ queryKey: ['estimates'] })
      }
      setDetailLead(null)
    },
    onError: (e: Error) => toast.error('Failed to update lead', { description: e.message }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/leads/${id}`),
    onSuccess: () => {
      toast.success('Lead deleted')
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      setDeleteLead(null)
    },
    onError: (e: Error) => toast.error('Failed to delete lead', { description: e.message }),
  })

  // Bulk stage advancement — applies to all selected leads
  const bulkUpdateMut = useMutation({
    mutationFn: async ({ ids, body }: { ids: string[]; body: Record<string, unknown> }) => {
      const results = await Promise.allSettled(
        ids.map(id => apiPatch(`/api/leads/${id}`, body))
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      return { succeeded, failed }
    },
    onSuccess: ({ succeeded, failed }) => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      setSelectedIds(new Set())
      toast.success(`Bulk updated ${succeeded} lead${succeeded === 1 ? '' : 's'}`, {
        description: failed > 0 ? `${failed} failed` : undefined,
      })
    },
    onError: (e: Error) => toast.error('Bulk update failed', { description: e.message }),
  })

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (prev.size === filtered.length) return new Set()
      return new Set(filtered.map(l => l.id))
    })
  }

  const leads = leadsQ.data?.leads || []

  // Compute unique territories for the filter dropdown
  const territories = Array.from(new Set(leads.map(l => l.territory).filter(Boolean))).sort()

  const filtered = leads.filter(l => {
    if (stageFilter !== 'all' && l.stage !== stageFilter) return false
    if (territoryFilter !== 'all' && l.territory !== territoryFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        l.street.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.territory.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleImportCsv = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length === 0) {
        toast.error('CSV is empty')
        return
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const findIdx = (...names: string[]) =>
        headers.findIndex(h => names.includes(h))
      const idx = {
        name: findIdx('name', 'customer'),
        phone: findIdx('phone', 'mobile'),
        email: findIdx('email'),
        street: findIdx('street', 'address'),
        city: findIdx('city'),
        state: findIdx('state'),
        zip: findIdx('zip', 'zipcode', 'postal'),
        source: findIdx('source'),
        territory: findIdx('territory'),
        notes: findIdx('notes'),
      }
      let imported = 0
      let failed = 0
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim())
        const street = idx.street >= 0 ? cols[idx.street] : ''
        if (!street) { failed++; continue }
        const body: Record<string, unknown> = {
          street,
          name: idx.name >= 0 ? cols[idx.name] : '',
          phone: idx.phone >= 0 ? cols[idx.phone] : '',
          email: idx.email >= 0 ? cols[idx.email] : '',
          city: idx.city >= 0 ? cols[idx.city] : 'Mount Vernon',
          state: idx.state >= 0 ? cols[idx.state] : 'OH',
          zip: idx.zip >= 0 ? cols[idx.zip] : '',
          source: idx.source >= 0 ? cols[idx.source] : 'door_knock',
          territory: idx.territory >= 0 ? cols[idx.territory] : 'Knox County',
          notes: idx.notes >= 0 ? cols[idx.notes] : '',
        }
        try {
          await apiPost('/api/leads', body)
          imported++
        } catch {
          failed++
        }
      }
      toast.success(`Imported ${imported} lead${imported === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}`)
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
    } catch (e) {
      toast.error('CSV import failed', { description: (e as Error).message })
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div data-tut="toolbar" className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="size-4" /> New Lead
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" /> Import CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleImportCsv(f)
            e.target.value = ''
          }}
        />
        <div className="relative ml-auto">
          <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search address, name, phone…"
            className="pl-8 w-full sm:w-64 h-9"
            aria-label="Search leads"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger size="sm" className="w-40" aria-label="Filter by stage">
            <Filter className="size-3.5 mr-1 text-slate-500" aria-hidden="true" />
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {LEAD_STAGES.map(s => (
              <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {territories.length > 1 && (
          <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
            <SelectTrigger size="sm" className="w-40" aria-label="Filter by territory">
              <MapPin className="size-3.5 mr-1 text-slate-500" aria-hidden="true" />
              <SelectValue placeholder="All territories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All territories</SelectItem>
              {territories.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk action bar — appears when leads are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg border border-[#0084ff]/30 bg-[#0084ff]/5 p-3">
          <div className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-[#0084ff] text-white flex items-center justify-center shrink-0">
              <Layers className="size-4" />
            </span>
            <div>
              <div className="text-sm font-bold text-[#071321]">
                {selectedIds.size} lead{selectedIds.size === 1 ? '' : 's'} selected
              </div>
              <div className="text-xs text-slate-500">Choose a bulk action below</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value="" onValueChange={(v) => {
              if (v) {
                bulkUpdateMut.mutate({ ids: Array.from(selectedIds), body: { stage: v } })
              }
            }}>
              <SelectTrigger size="sm" className="w-44" aria-label="Bulk advance stage">
                <ChevronRight className="size-3.5 mr-1 text-[#0084ff]" />
                <SelectValue placeholder="Set stage…" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map(s => (
                  <SelectItem key={s} value={s}>→ {stageLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedIds(new Set())}
              className="border-slate-300"
            >
              <X className="size-4" /> Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card data-tut="table" className="border-[#d6e2ee]">
        <CardContent className="p-0">
          {leadsQ.isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onCreate={() => setNewOpen(true)} hasLeads={leads.length > 0} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f5f8fc] hover:bg-[#f5f8fc]">
                  <TableHead className="pl-4 w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all leads"
                    />
                  </TableHead>
                  <TableHead>Property / Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Source / Territory</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden lg:table-cell">Next Action</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(lead => (
                  <TableRow key={lead.id} className={selectedIds.has(lead.id) ? 'bg-[#0084ff]/5' : ''}>
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                        aria-label={`Select lead ${lead.street}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-[#071321] text-sm leading-tight">
                        {lead.street}{lead.city ? `, ${lead.city}` : ''}{lead.state ? `, ${lead.state}` : ''}{lead.zip ? ` ${lead.zip}` : ''}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {lead.name || '—'}{lead.phone ? ` · ${lead.phone}` : ''}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-600">
                      <div className="font-medium capitalize">{(lead.source || 'door_knock').replace(/_/g, ' ')}</div>
                      <div className="text-slate-400">{lead.territory || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={stageBadgeClasses(lead.stage)}>
                        {stageLabel(lead.stage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600 max-w-[260px] truncate">
                      {lead.nextAction || '—'}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Select
                          value=""
                          onValueChange={(v) => {
                            if (v && v !== lead.stage) {
                              updateMut.mutate({ id: lead.id, body: { stage: v } })
                            }
                          }}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-8 h-8 p-0 border-transparent bg-transparent hover:bg-[#f5f8fc] justify-center"
                            aria-label={`Quick-advance stage for ${lead.street}`}
                          >
                            <ChevronRight className="size-3.5 text-slate-400" />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STAGES.filter(s => s !== lead.stage).map(s => (
                              <SelectItem key={s} value={s}>
                                → {stageLabel(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailLead(lead)}
                        >
                          Manage
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete lead ${lead.street}`}
                          onClick={() => setDeleteLead(lead)}
                        >
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Lead Dialog */}
      <NewLeadDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSubmit={body => createMut.mutate(body)}
        submitting={createMut.isPending}
        existingLeads={leads}
        onOpenExisting={(lead) => {
          setNewOpen(false)
          setDetailLead(lead)
        }}
      />

      {/* Detail Dialog */}
      {detailLead && (
        <LeadDetailDialog
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onSave={body => updateMut.mutate({ id: detailLead.id, body })}
          onMeasure={() => {
            const prefill: MeasurePrefill = {
              leadId: detailLead.id,
              street: detailLead.street,
              city: detailLead.city,
              state: detailLead.state,
              zip: detailLead.zip,
              pitch: detailLead.pitch ?? undefined,
              area: detailLead.verifiedArea ?? undefined,
            }
            setDetailLead(null)
            onMeasureLead(prefill)
          }}
          submitting={updateMut.isPending}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteLead} onOpenChange={o => !o && setDeleteLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteLead?.street}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteLead && deleteMut.mutate(deleteLead.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ onCreate, hasLeads }: { onCreate: () => void; hasLeads: boolean }) {
  return (
    <div className="p-10 text-center">
      <Users className="size-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[#071321]">
        {hasLeads ? 'No leads match your filter' : 'No leads yet'}
      </h3>
      <p className="text-sm text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
        {hasLeads
          ? 'Try clearing the stage filter or search to see your full pipeline.'
          : 'Capture your first door-knock or referral to start the operating loop.'}
      </p>
      {!hasLeads && (
        <Button size="sm" className="bg-[#0084ff] hover:bg-[#0070e0] text-white" onClick={onCreate}>
          <Plus className="size-4" /> New Lead
        </Button>
      )}
    </div>
  )
}

interface NewLeadFormState {
  name: string
  phone: string
  email: string
  street: string
  city: string
  state: string
  zip: string
  source: string
  territory: string
  notes: string
}

function NewLeadDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  existingLeads,
  onOpenExisting,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onSubmit: (body: Record<string, unknown>) => void
  submitting: boolean
  existingLeads: Lead[]
  onOpenExisting: (lead: Lead) => void
}) {
  const [form, setForm] = useState<NewLeadFormState>({
    name: '',
    phone: '',
    email: '',
    street: '',
    city: 'Mount Vernon',
    state: 'OH',
    zip: '',
    source: 'door_knock',
    territory: 'Knox County',
    notes: '',
  })

  const set = (k: keyof NewLeadFormState, v: string) => setForm(s => ({ ...s, [k]: v }))

  // Duplicate detection — check for matching street (case-insensitive, trimmed)
  // or matching phone digits. Only runs when the user has typed enough to match.
  const normalizedStreet = form.street.trim().toLowerCase()
  const phoneDigits = form.phone.replace(/\D/g, '')
  const duplicates = existingLeads.filter(l => {
    const streetMatch = normalizedStreet.length >= 5 &&
      l.street.trim().toLowerCase() === normalizedStreet
    const phoneMatch = phoneDigits.length >= 7 &&
      l.phone.replace(/\D/g, '') === phoneDigits
    return streetMatch || phoneMatch
  })
  const hasDuplicate = duplicates.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.street.trim()) {
      toast.error('Street address is required')
      return
    }
    if (!form.city.trim() || !form.state.trim()) {
      toast.error('City and state are required for address verification')
      return
    }
    onSubmit({ ...form })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-[#0084ff]" /> New Lead
          </DialogTitle>
          <DialogDescription>
            Capture every door-knock, referral, and storm canvas contact. Street, city, and state are required. The property is verified before it can be mapped or routed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Duplicate warning */}
          {hasDuplicate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-start gap-2 text-amber-800">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold">Possible duplicate lead detected</div>
                  <div className="text-amber-700 mt-0.5">
                    {duplicates.length} lead{duplicates.length === 1 ? '' : 's'} with a matching street address or phone already exists in the pipeline.
                  </div>
                </div>
              </div>
              <ul className="space-y-1">
                {duplicates.map(d => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onOpenExisting(d)}
                      className="w-full text-left rounded-md bg-white border border-amber-200 px-2.5 py-1.5 text-xs hover:border-amber-400 hover:shadow-sm transition-all flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold text-[#071321] truncate block">{d.street}</span>
                        <span className="text-slate-500">{d.name || 'Unknown'} · {stageLabel(d.stage)}</span>
                      </span>
                      <span className="text-[#0084ff] font-medium shrink-0 inline-flex items-center gap-0.5">
                        Open <ArrowUpRight className="size-3" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-amber-700 pt-0.5">
                You can still save this lead if it&apos;s genuinely new (e.g. a different unit or a re-canvass).
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nl-name">Customer name</Label>
              <Input id="nl-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Homeowner" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-phone">Phone</Label>
              <Input id="nl-phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(740) 555-0123" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-email">Email</Label>
            <Input id="nl-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-street">Street address <span className="text-red-500">*</span></Label>
            <Input id="nl-street" value={form.street} onChange={e => set('street', e.target.value)} placeholder="123 Main St" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nl-city">City <span className="text-red-500">*</span></Label>
              <Input id="nl-city" value={form.city} onChange={e => set('city', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-state">State <span className="text-red-500">*</span></Label>
              <Input id="nl-state" value={form.state} onChange={e => set('state', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-zip">ZIP</Label>
              <Input id="nl-zip" value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="43050" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nl-source">Source</Label>
              <Select value={form.source} onValueChange={v => set('source', v)}>
                <SelectTrigger id="nl-source" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nl-territory">Territory</Label>
              <Select value={form.territory} onValueChange={v => set('territory', v)}>
                <SelectTrigger id="nl-territory" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TERRITORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-notes">Notes</Label>
            <Textarea id="nl-notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Storm damage visible from curb. Homeowner out of town until Thursday." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              <X className="size-4" /> Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-[#0084ff] hover:bg-[#0070e0] text-white">
              <Save className="size-4" /> {submitting ? 'Saving…' : 'Save Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LeadDetailDialog({
  lead,
  onClose,
  onSave,
  onMeasure,
  submitting,
}: {
  lead: Lead
  onClose: () => void
  onSave: (body: Record<string, unknown>) => void
  onMeasure: () => void
  submitting: boolean
}) {
  const [stage, setStage] = useState<LeadStage>(lead.stage as LeadStage)
  const [nextAction, setNextAction] = useState(lead.nextAction || '')
  const [notes, setNotes] = useState(lead.notes || '')
  const [name, setName] = useState(lead.name)
  const [phone, setPhone] = useState(lead.phone)
  const [email, setEmail] = useState(lead.email)

  const handleSave = () => {
    onSave({ stage, nextAction, notes, name, phone, email })
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-[#0084ff]" /> Lead Detail
          </DialogTitle>
          <DialogDescription>
            {lead.street}{lead.city ? `, ${lead.city}` : ''}{lead.state ? `, ${lead.state}` : ''}{lead.zip ? ` ${lead.zip}` : ''}
            {' · '}Added {fmtDate(lead.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-3 mt-3">
            {lead.verifiedArea != null && (
              <div className="rounded-md bg-[#0084ff]/5 border border-[#0084ff]/15 p-2.5 text-xs text-[#071321]">
                <span className="font-semibold">Verified Roof Area:</span> {Math.round(lead.verifiedArea)} sq ft
                {lead.pitch != null && <> · <span className="font-semibold">Pitch:</span> {lead.pitch}/12</>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ld-name">Customer name</Label>
                <Input id="ld-name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ld-phone">Phone</Label>
                <Input id="ld-phone" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ld-email">Email</Label>
              <Input id="ld-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ld-stage">Stage</Label>
                <Select value={stage} onValueChange={(v: string) => setStage(v as LeadStage)}>
                  <SelectTrigger id="ld-stage" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map(s => <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ld-next">Next action</Label>
              <Input id="ld-next" value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Call Thursday AM to schedule inspection" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ld-notes">Notes</Label>
              <Textarea id="ld-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={5} />
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            <LeadTimeline leadId={lead.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onMeasure}
            className="sm:mr-auto"
          >
            <Ruler className="size-4" /> Measure Property →
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
          >
            <Save className="size-4" /> {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const TIMELINE_ICON: Record<TimelineEvent['type'], typeof Camera> = {
  lead_created: Users,
  stage_advanced: ArrowUpRight,
  inspection: Camera,
  estimate: FileText,
  job: Hammer,
}

const TIMELINE_COLOR: Record<TimelineEvent['type'], string> = {
  lead_created: '#0084ff',
  stage_advanced: '#8b5cf6',
  inspection: '#ec4899',
  estimate: '#f59e0b',
  job: '#06b6d4',
}

function LeadTimeline({ leadId }: { leadId: string }) {
  const q = useQuery({
    queryKey: ['lead-timeline', leadId],
    queryFn: () => apiGet<{ lead: Lead; events: TimelineEvent[] }>(`/api/leads/${leadId}/timeline`),
    enabled: !!leadId,
  })

  if (q.isLoading) {
    return <div className="space-y-2 py-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
  }
  if (q.isError) {
    return (
      <div className="py-6 text-center text-sm text-red-600">
        Failed to load timeline. {(q.error as Error)?.message}
      </div>
    )
  }

  const events = q.data?.events || []
  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="size-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="relative pl-7 py-2">
      {/* Vertical spine */}
      <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-[#e2ebf5]" aria-hidden="true" />
      <ul className="space-y-3.5">
        {events.map((e, i) => {
          const Icon = TIMELINE_ICON[e.type] || Clock
          const color = TIMELINE_COLOR[e.type] || '#64748b'
          return (
            <li key={i} className="relative">
              <span
                className="absolute -left-[22px] top-0 size-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="bg-white border border-[#e5edf5] rounded-lg p-2.5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-[#071321] leading-tight">{e.title}</div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
                    {fmtDateTime(e.timestamp)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{e.detail}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
