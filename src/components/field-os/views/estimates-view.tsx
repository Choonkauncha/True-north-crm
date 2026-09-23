'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  CheckCircle2,
  Paperclip,
  Upload,
  Clock,
  XCircle,
  Check,
  Eye,
  GitCompare,
  X,
  Trophy,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  apiGet,
  apiPatch,
  apiPost,
  fmtDate,
  fmtMoney,
  fmtMoneyDetail,
  type Estimate,
} from '@/lib/tn-api'
import { PrintableProposal } from '@/components/field-os/printable-proposal'

const STATUS_TONES: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-amber-50 text-amber-700 border-amber-200',
}

function marginTone(pct: number): string {
  if (pct >= 35) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (pct >= 25) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-red-50 text-red-700 border-red-200'
}

export function EstimatesView() {
  const qc = useQueryClient()
  const [acceptTarget, setAcceptTarget] = useState<Estimate | null>(null)
  const [viewEstimateId, setViewEstimateId] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const estimatesQ = useQuery({
    queryKey: ['estimates'],
    queryFn: () => apiGet<{ estimates: Estimate[] }>('/api/estimates'),
  })

  const acceptMut = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/estimates/${id}`, { status: 'accepted' }),
    onSuccess: () => {
      toast.success('Estimate accepted', { description: 'Lead advanced to Follow Up — sign the contract next.' })
      qc.invalidateQueries({ queryKey: ['estimates'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      setAcceptTarget(null)
    },
    onError: (e: Error) => toast.error('Failed to accept estimate', { description: e.message }),
  })

  const createJobMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/jobs', body),
    onSuccess: () => {
      toast.success('Job created', { description: 'Signed contract attached · lead advanced to Contracted.' })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['estimates'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
    },
    onError: (e: Error) => toast.error('Failed to create job', { description: e.message }),
  })

  const handleContractFile = (estimate: Estimate, file: File | undefined) => {
    if (!file) return
    createJobMut.mutate({
      estimateId: estimate.id,
      leadId: estimate.leadId || undefined,
      property: estimate.property,
      contractValue: estimate.price,
      contractFilename: file.name,
    })
  }

  const estimates = estimatesQ.data?.estimates || []

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id] // keep only the last 2
      return [...prev, id]
    })
  }

  const compareEstimates = compareIds
    .map(id => estimates.find(e => e.id === id))
    .filter((e): e is Estimate => !!e)

  return (
    <div className="space-y-4">
      {/* Toolbar with compare action */}
      {estimates.length >= 2 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-slate-500">
            {compareIds.length === 0
              ? 'Select up to 2 estimates to compare pricing, margins, and materials side-by-side.'
              : `${compareIds.length} of 2 selected for comparison`}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCompareOpen(true)}
            disabled={compareIds.length < 2}
            className="border-[#0084ff]/30 text-[#0084ff] hover:bg-[#0084ff]/5"
          >
            <GitCompare className="size-4" /> Compare ({compareIds.length})
          </Button>
        </div>
      )}

      <Card data-tut="table" className="border-[#d6e2ee]">
        <CardContent className="p-0">
          {estimatesQ.isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : estimates.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f5f8fc] hover:bg-[#f5f8fc]">
                  {estimates.length >= 2 && (
                    <TableHead className="pl-4 w-10">Compare</TableHead>
                  )}
                  <TableHead className={estimates.length >= 2 ? '' : 'pl-4'}>Estimate #</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="hidden md:table-cell">IKO Material</TableHead>
                  <TableHead className="hidden lg:table-cell">Area / Squares</TableHead>
                  <TableHead className="text-right">Client Price</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Margin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead data-tut="actions" className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map(est => (
                  <TableRow key={est.id} className={compareIds.includes(est.id) ? 'bg-[#0084ff]/5' : ''}>
                    {estimates.length >= 2 && (
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={compareIds.includes(est.id)}
                          onCheckedChange={() => toggleCompare(est.id)}
                          aria-label={`Select estimate ${est.id.slice(-6).toUpperCase()} for comparison`}
                        />
                      </TableCell>
                    )}
                    <TableCell className={`font-mono text-xs text-slate-600 ${estimates.length < 2 ? 'pl-4' : ''}`}>
                      #{est.id.slice(-6).toUpperCase()}
                      <div className="text-[10px] text-slate-400 font-sans">{fmtDate(est.createdAt)}</div>
                    </TableCell>
                    <TableCell className="font-medium text-[#071321] text-sm max-w-[220px] truncate">
                      {est.property}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-600">
                      <div className="font-medium text-[#071321]">{est.product || est.productId}</div>
                      {est.color && <div className="text-slate-400">{est.color}</div>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-slate-600">
                      {Math.round(est.area).toLocaleString()} ft² · {est.squares.toFixed(2)} sq
                    </TableCell>
                    <TableCell className="text-right font-bold text-[#071321]">
                      {fmtMoney(est.price)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      <Badge variant="outline" className={marginTone(est.grossMarginPct)}>
                        {est.grossMarginPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONES[est.status] || STATUS_TONES.sent}>
                        {est.status === 'sent' && <Clock className="size-3" />}
                        {est.status === 'accepted' && <CheckCircle2 className="size-3" />}
                        {(est.status === 'rejected' || est.status === 'expired') && <XCircle className="size-3" />}
                        <span className="capitalize">{est.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewEstimateId(est.id)}
                          aria-label={`View proposal ${est.id.slice(-6).toUpperCase()}`}
                          title="View printable proposal"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {est.status !== 'accepted' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAcceptTarget(est)}
                          >
                            <Check className="size-3.5" /> Accept
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="bg-[#10b981] hover:bg-[#0ea368] text-white"
                              onClick={() => fileInputRefs.current[est.id]?.click()}
                              disabled={createJobMut.isPending}
                            >
                              <Paperclip className="size-3.5" /> Attach Contract
                            </Button>
                            <input
                              ref={el => { fileInputRefs.current[est.id] = el }}
                              type="file"
                              accept=".pdf,.doc,.docx,image/*"
                              className="hidden"
                              onChange={e => {
                                handleContractFile(est, e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!acceptTarget} onOpenChange={o => !o && setAcceptTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this estimate?</AlertDialogTitle>
            <AlertDialogDescription>
              {acceptTarget?.property} · {fmtMoney(acceptTarget?.price ?? 0)}.
              The lead will advance to Follow Up so you can sign the contract. Accepted estimates are not jobs — you must attach a signed contract to create a job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#10b981] hover:bg-[#0ea368] text-white"
              onClick={() => acceptTarget && acceptMut.mutate(acceptTarget.id)}
            >
              Accept Estimate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrintableProposal estimateId={viewEstimateId} onClose={() => setViewEstimateId(null)} />

      {/* Estimate comparison dialog */}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        estimates={compareEstimates}
        onClear={() => setCompareIds([])}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <FileText className="size-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[#071321]">No estimates yet</h3>
      <p className="text-sm text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
        Build your first IKO proposal in Measure + Estimate. Each proposal shows price, margin, and status here.
      </p>
      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <Upload className="size-3.5" />
        Tip: accepted estimates get an "Attach Contract" button.
      </div>
    </div>
  )
}

/**
 * Side-by-side comparison of up to 2 estimates.
 * Highlights the better value (lower price, higher margin) with a trophy icon.
 */
function CompareDialog({
  open,
  onOpenChange,
  estimates,
  onClear,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  estimates: Estimate[]
  onClear: () => void
}) {
  if (estimates.length === 0) return null
  const [a, b] = estimates
  const hasB = !!b

  // Determine winners
  const cheaper = hasB && a.price !== b.price
    ? (a.price < b.price ? a : b)
    : null
  const higherMargin = hasB && a.grossMarginPct !== b.grossMarginPct
    ? (a.grossMarginPct > b.grossMarginPct ? a : b)
    : null

  const renderRow = (label: string, valueA: React.ReactNode, valueB: React.ReactNode, winnerA?: boolean, winnerB?: boolean) => (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-[#e5edf5] last:border-0">
      <div className="text-xs text-slate-500 font-medium flex items-center gap-1">{label}</div>
      <div className={`text-sm font-semibold ${winnerA ? 'text-emerald-700' : 'text-[#071321]'}`}>
        {winnerA && <Trophy className="size-3 inline mr-1 text-emerald-500" />}
        {valueA}
      </div>
      <div className={`text-sm font-semibold ${winnerB ? 'text-emerald-700' : hasB ? 'text-[#071321]' : 'text-slate-300'}`}>
        {hasB ? (
          <>
            {winnerB && <Trophy className="size-3 inline mr-1 text-emerald-500" />}
            {valueB}
          </>
        ) : '—'}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        {/* Print-only header — True North branding for the printed comparison */}
        <div className="hidden print:block px-8 pt-6 pb-4 border-b-2 border-[#071321]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/true-north-logo.png"
                alt="True North Restorations"
                className="w-12 h-12 rounded-lg ring-1 ring-[#40d4ff]/30 bg-[#0c1a2c]"
              />
              <div>
                <div className="text-lg font-bold text-[#071321]">True North Restorations</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#0084ff] font-semibold">Estimate Comparison</div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              {fmtDate(new Date().toISOString())}
            </div>
          </div>
        </div>

        {/* On-screen header (hidden when printing) */}
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="size-5 text-[#0084ff]" /> Estimate Comparison
          </DialogTitle>
          <DialogDescription>
            Side-by-side comparison of {estimates.length} estimate{estimates.length === 1 ? '' : 's'}.
            {hasB && ' The better value on each row is highlighted with a trophy.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Headers */}
          <div className="grid grid-cols-3 gap-2 pb-2 border-b-2 border-[#071321]">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Metric</div>
            <div className="text-xs font-bold text-[#071321]">
              <span className="font-mono">#{a.id.slice(-6).toUpperCase()}</span>
              <div className="text-[10px] text-slate-400 font-normal truncate">{a.property}</div>
            </div>
            <div className="text-xs font-bold text-[#071321]">
              {hasB ? (
                <>
                  <span className="font-mono">#{b.id.slice(-6).toUpperCase()}</span>
                  <div className="text-[10px] text-slate-400 font-normal truncate">{b.property}</div>
                </>
              ) : (
                <span className="text-slate-400">Select a second estimate</span>
              )}
            </div>
          </div>

          {renderRow('Client Price', fmtMoney(a.price), hasB ? fmtMoney(b.price) : null, cheaper === a, cheaper === b)}
          {renderRow('Direct Cost', fmtMoney(a.directCost), hasB ? fmtMoney(b.directCost) : null)}
          {renderRow('Gross Profit', fmtMoney(a.grossProfit), hasB ? fmtMoney(b.grossProfit) : null)}
          {renderRow('Gross Margin', `${a.grossMarginPct.toFixed(1)}%`, hasB ? `${b.grossMarginPct.toFixed(1)}%` : null, higherMargin === a, higherMargin === b)}
          {renderRow('Roof Area', `${Math.round(a.area).toLocaleString()} ft²`, hasB ? `${Math.round(b.area).toLocaleString()} ft²` : null)}
          {renderRow('Squares', a.squares.toFixed(2), hasB ? b.squares.toFixed(2) : null)}
          {renderRow('Waste %', `${a.wastePct}%`, hasB ? `${b.wastePct}%` : null)}
          {renderRow('Discount', fmtMoneyDetail(a.discount), hasB ? fmtMoneyDetail(b.discount) : null)}
          {renderRow('Shingle $/sq', fmtMoneyDetail(a.shinglePerSq), hasB ? fmtMoneyDetail(b.shinglePerSq) : null)}
          {renderRow('IKO Product', a.product || a.productId, hasB ? (b.product || b.productId) : null)}
          {renderRow('Color', a.color || '—', hasB ? (b.color || '—') : null)}
          {renderRow('Pricing Profile', a.profileName, hasB ? b.profileName : null)}
          {renderRow('Status', <span className="capitalize">{a.status}</span>, hasB ? <span className="capitalize">{b.status}</span> : null)}
        </div>

        {/* Summary verdict */}
        {hasB && (
          <div className="rounded-lg border border-[#0084ff]/20 bg-[#0084ff]/5 p-3 text-sm">
            <div className="font-semibold text-[#071321] mb-1">Summary</div>
            {cheaper && (
              <div className="text-xs text-slate-600">
                <span className="font-mono">#{cheaper.id.slice(-6).toUpperCase()}</span> is <span className="font-semibold text-emerald-700">{fmtMoney(Math.abs(a.price - b.price))}</span> cheaper.
              </div>
            )}
            {higherMargin && (
              <div className="text-xs text-slate-600 mt-0.5">
                <span className="font-mono">#{higherMargin.id.slice(-6).toUpperCase()}</span> has a <span className="font-semibold text-emerald-700">{Math.abs(a.grossMarginPct - b.grossMarginPct).toFixed(1)}%</span> higher gross margin.
              </div>
            )}
            {!cheaper && !higherMargin && (
              <div className="text-xs text-slate-600">Both estimates have identical pricing and margins.</div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 print:hidden">
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="size-4" /> Clear selection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-[#0084ff]/30 text-[#0084ff] hover:bg-[#0084ff]/5"
          >
            <Printer className="size-4" /> Print Comparison
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
