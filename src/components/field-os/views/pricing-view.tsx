'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign,
  Save,
  Star,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  apiGet,
  apiPost,
  fmtMoneyDetail,
  type CatalogResponse,
  type PricingProfile,
} from '@/lib/tn-api'

export function PricingView() {
  const catalogQ = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogResponse>('/api/catalog'),
  })

  const profiles = catalogQ.data?.profiles || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
      {/* Active Pricing Profiles */}
      <Card data-tut="profiles" className="border-[#d6e2ee]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center">
              <DollarSign className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base text-[#071321]">Active Pricing Profiles</CardTitle>
              <CardDescription>Real-cost bases for every IKO estimate.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {catalogQ.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500 border border-dashed border-[#d6e2ee] rounded-lg">
              No pricing profiles. Create one →
            </div>
          ) : (
            <ul className="space-y-3 max-h-[640px] overflow-y-auto pr-1 -mr-1">
              {profiles.map(p => (
                <li key={p.id} className="rounded-lg border border-[#d6e2ee] p-3 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="font-semibold text-[#071321] text-sm truncate">{p.name}</h4>
                      {p.isDefault && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 shrink-0">
                          <Star className="size-3" /> Default
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 shrink-0">
                      <TrendingUp className="size-3" /> {p.targetGrossMarginPct}% margin
                    </Badge>
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <CostRow label="Material / sq" value={p.materialPerSq} />
                    <CostRow label="Labor / sq" value={p.laborPerSq} />
                    <CostRow label="Tear-off / sq" value={p.tearOffPerSq} />
                    <CostRow label="Underlayment / sq" value={p.underlaymentPerSq} />
                    <CostRow label="Accessories / sq" value={p.accessoriesPerSq} />
                    <CostRow label="Sales commission" value={p.salesCommissionPct} suffix="%" />
                    <CostRow label="Disposal / job" value={p.disposalPerJob} />
                    <CostRow label="Permit / job" value={p.permitPerJob} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create Real-Cost Profile */}
      <Card data-tut="form" className="border-[#d6e2ee]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center">
              <TrendingUp className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base text-[#071321]">Create Real-Cost Profile</CardTitle>
              <CardDescription>Material, labor, tear-off, fixed costs, target margin.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ProfileForm />
        </CardContent>
      </Card>
    </div>
  )
}

function CostRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-[#071321]">
        {suffix === '%' ? `${value}%` : fmtMoneyDetail(value)}
      </span>
    </div>
  )
}

interface ProfileFormState {
  name: string
  materialPerSq: string
  laborPerSq: string
  tearOffPerSq: string
  underlaymentPerSq: string
  accessoriesPerSq: string
  disposalPerJob: string
  permitPerJob: string
  salesCommissionPct: string
  targetGrossMarginPct: string
}

const DEFAULTS: ProfileFormState = {
  name: '',
  materialPerSq: '135',
  laborPerSq: '85',
  tearOffPerSq: '35',
  underlaymentPerSq: '22',
  accessoriesPerSq: '28',
  disposalPerJob: '450',
  permitPerJob: '200',
  salesCommissionPct: '10',
  targetGrossMarginPct: '35',
}

function ProfileForm() {
  const qc = useQueryClient()
  const [form, setForm] = useState<ProfileFormState>(DEFAULTS)

  const set = (k: keyof ProfileFormState, v: string) => setForm(s => ({ ...s, [k]: v }))

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/profiles', body),
    onSuccess: () => {
      toast.success('Pricing profile saved')
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['catalog'] })
      setForm(DEFAULTS)
    },
    onError: (e: Error) => toast.error('Failed to save profile', { description: e.message }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Profile name is required'); return }
    saveMut.mutate({
      name: form.name,
      materialPerSq: Number(form.materialPerSq) || 0,
      laborPerSq: Number(form.laborPerSq) || 0,
      tearOffPerSq: Number(form.tearOffPerSq) || 0,
      underlaymentPerSq: Number(form.underlaymentPerSq) || 0,
      accessoriesPerSq: Number(form.accessoriesPerSq) || 0,
      disposalPerJob: Number(form.disposalPerJob) || 0,
      permitPerJob: Number(form.permitPerJob) || 0,
      salesCommissionPct: Number(form.salesCommissionPct) || 0,
      targetGrossMarginPct: Number(form.targetGrossMarginPct) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pf-name">Profile name</Label>
        <Input id="pf-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. IKO Dynasty — Storm Premium 2026" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Per Square Costs ($)</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Material / sq" value={form.materialPerSq} onChange={v => set('materialPerSq', v)} />
          <Field label="Labor / sq" value={form.laborPerSq} onChange={v => set('laborPerSq', v)} />
          <Field label="Tear-off / sq" value={form.tearOffPerSq} onChange={v => set('tearOffPerSq', v)} />
          <Field label="Underlayment / sq" value={form.underlaymentPerSq} onChange={v => set('underlaymentPerSq', v)} />
          <Field label="Accessories / sq" value={form.accessoriesPerSq} onChange={v => set('accessoriesPerSq', v)} />
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Fixed Costs ($/job) & Margin</div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Disposal / job" value={form.disposalPerJob} onChange={v => set('disposalPerJob', v)} />
          <Field label="Permit / job" value={form.permitPerJob} onChange={v => set('permitPerJob', v)} />
          <Field label="Sales commission %" value={form.salesCommissionPct} onChange={v => set('salesCommissionPct', v)} />
          <Field label="Target gross margin %" value={form.targetGrossMarginPct} onChange={v => set('targetGrossMarginPct', v)} />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full bg-[#f59e0b] hover:bg-[#d97f0a] text-white"
        disabled={saveMut.isPending}
      >
        <Save className="size-4" /> {saveMut.isPending ? 'Saving…' : 'Save Pricing Profile'}
      </Button>
    </form>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <Input type="number" min="0" step="0.01" value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  )
}
