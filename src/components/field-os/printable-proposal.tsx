'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Printer, X, MapPin, User, Phone, Mail, ShieldCheck, Wind, CloudHail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  apiGet,
  fmtMoney,
  fmtMoneyDetail,
  fmtDate,
  type EstimateDetailResponse,
} from '@/lib/tn-api'

interface PrintableProposalProps {
  estimateId: string | null
  onClose: () => void
}

export function PrintableProposal({ estimateId, onClose }: PrintableProposalProps) {
  const q = useQuery({
    queryKey: ['estimate-detail', estimateId],
    queryFn: () => apiGet<EstimateDetailResponse>(`/api/estimates/${estimateId}/detail`),
    enabled: !!estimateId,
  })

  // Lock body scroll while the printable dialog is open
  useEffect(() => {
    if (estimateId) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [estimateId])

  const open = !!estimateId
  const data = q.data
  const est = data?.estimate
  const lead = data?.lead
  const product = data?.product
  const job = data?.job

  // Recompute the line-item breakdown from the saved fields for the printable view
  const breakdown = est ? computeBreakdown(est) : null

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Printable proposal {est ? `#${est.id.slice(-6).toUpperCase()}` : ''}</DialogTitle>

        {/* Action bar (screen-only, hidden on print) */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#d6e2ee] px-5 py-3 flex items-center justify-between print:hidden">
          <div className="text-sm font-semibold text-[#071321]">
            {q.isLoading ? 'Loading proposal…' : est ? `Proposal #${est.id.slice(-6).toUpperCase()}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
              onClick={() => window.print()}
              disabled={!est}
            >
              <Printer className="size-4" /> Print / Save PDF
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {q.isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : q.isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            Failed to load proposal. {(q.error as Error)?.message}
          </div>
        ) : est ? (
          <div className="px-8 py-6 print:px-6 print:py-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#071321] pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/true-north-logo.png"
                  alt="True North Restorations"
                  className="w-14 h-14 rounded-lg ring-1 ring-[#40d4ff]/30 bg-[#0c1a2c]"
                />
                <div>
                  <div className="text-xl font-bold text-[#071321] tracking-tight">True North Restorations</div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[#0084ff] font-semibold">Residential Roofing · Central Ohio</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Mount Vernon, Knox County · OH</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Proposal #</div>
                <div className="font-mono font-bold text-[#071321]">#{est.id.slice(-6).toUpperCase()}</div>
                <div className="text-[10px] text-slate-500 mt-1">Issued {fmtDate(est.createdAt)}</div>
                {est.status === 'accepted' && (
                  <Badge variant="outline" className="mt-1 bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    <ShieldCheck className="size-2.5" /> Accepted
                  </Badge>
                )}
              </div>
            </div>

            {/* Customer + Property */}
            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Prepared For</div>
                {lead ? (
                  <div className="space-y-0.5 text-sm text-[#071321]">
                    {lead.name && <div className="font-semibold flex items-center gap-1.5"><User className="size-3.5 text-slate-400" /> {lead.name}</div>}
                    {lead.phone && <div className="flex items-center gap-1.5 text-slate-600"><Phone className="size-3.5 text-slate-400" /> {lead.phone}</div>}
                    {lead.email && <div className="flex items-center gap-1.5 text-slate-600"><Mail className="size-3.5 text-slate-400" /> {lead.email}</div>}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Unlinked property</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Property</div>
                <div className="text-sm text-[#071321] space-y-0.5">
                  <div className="font-semibold flex items-start gap-1.5"><MapPin className="size-3.5 text-slate-400 mt-0.5 shrink-0" /> {est.property}</div>
                  {lead?.verifiedArea != null && (
                    <div className="text-slate-600 text-xs ml-5">
                      Verified roof area: {Math.round(lead.verifiedArea).toLocaleString()} sq ft
                      {lead.pitch != null ? ` · ${lead.pitch}/12 pitch` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Material spec */}
            {product && (
              <div className="mt-5 rounded-lg border border-[#d6e2ee] bg-[#f5f8fc] p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Recommended Shingle</div>
                    <div className="font-bold text-[#071321] text-base">{product.name}</div>
                    {est.color && <div className="text-xs text-slate-600">Color: {est.color}</div>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-white">{product.warranty}</Badge>
                    <Badge variant="outline" className="text-[10px] bg-white"><Wind className="size-2.5" /> {product.windRating}</Badge>
                    {product.classRating.includes('Impact') && (
                      <Badge variant="outline" className="text-[10px] bg-white"><CloudHail className="size-2.5" /> {product.classRating}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Scope summary */}
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Scope of Work</div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f5f8fc] border-b border-[#d6e2ee]">
                    <th className="text-left py-2 px-3 font-semibold text-[#071321] text-xs uppercase tracking-wide">Item</th>
                    <th className="text-right py-2 px-3 font-semibold text-[#071321] text-xs uppercase tracking-wide">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#e5edf5]">
                    <td className="py-2 px-3 text-[#071321]">Verified roof surface area</td>
                    <td className="py-2 px-3 text-right font-medium text-[#071321]">{Math.round(est.area).toLocaleString()} sq ft</td>
                  </tr>
                  <tr className="border-b border-[#e5edf5]">
                    <td className="py-2 px-3 text-[#071321]">Total squares (with {est.wastePct}% waste factor)</td>
                    <td className="py-2 px-3 text-right font-medium text-[#071321]">{est.squares.toFixed(2)} sq</td>
                  </tr>
                  <tr className="border-b border-[#e5edf5]">
                    <td className="py-2 px-3 text-[#071321]">IKO shingle line</td>
                    <td className="py-2 px-3 text-right text-[#071321]">{est.product}</td>
                  </tr>
                  <tr className="border-b border-[#e5edf5]">
                    <td className="py-2 px-3 text-[#071321]">Shingle cost / square</td>
                    <td className="py-2 px-3 text-right text-[#071321]">{fmtMoneyDetail(est.shinglePerSq)}</td>
                  </tr>
                  <tr className="border-b border-[#e5edf5]">
                    <td className="py-2 px-3 text-[#071321]">Pricing profile</td>
                    <td className="py-2 px-3 text-right text-[#071321]">{est.profileName}</td>
                  </tr>
                  {est.discount > 0 && (
                    <tr className="border-b border-[#e5edf5]">
                      <td className="py-2 px-3 text-[#071321]">Discount applied</td>
                      <td className="py-2 px-3 text-right text-amber-700 font-medium">−{fmtMoney(est.discount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cost breakdown + total */}
            {breakdown && (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Direct Cost Breakdown</div>
                  <ul className="text-sm space-y-1">
                    {breakdown.lines.map(l => (
                      <li key={l.label} className="flex justify-between gap-2">
                        <span className="text-slate-600">{l.label}</span>
                        <span className="font-medium text-[#071321]">{fmtMoney(l.value)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-2 pt-1.5 border-t border-[#d6e2ee] font-semibold">
                      <span className="text-[#071321]">Total Direct Cost</span>
                      <span className="text-[#071321]">{fmtMoney(est.directCost)}</span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-[#071321] to-[#0c1a2c] text-white p-5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-[#40d4ff] font-semibold">Client Investment</div>
                    <div className="text-4xl font-bold mt-1">{fmtMoney(est.price)}</div>
                  </div>
                  <div className="mt-4 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#e2ebf5]/70">Gross profit</span>
                      <span className="font-semibold text-emerald-300">{fmtMoney(est.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#e2ebf5]/70">Gross margin</span>
                      <span className="font-semibold">{est.grossMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Terms */}
            <div className="mt-6 pt-4 border-t border-[#d6e2ee]">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Terms &amp; Conditions</div>
              <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
                <li>This proposal is valid for 30 days from the issued date.</li>
                <li>An accepted estimate is not a contract. A signed contract is required to schedule the job.</li>
                <li>Material cost is based on verified distributor pricing at the time of proposal.</li>
                <li>Labor, tear-off, underlayment, accessories, disposal, and permit costs are itemized above.</li>
                <li>Final invoice reflects actual costs and cash collected against the contract value.</li>
              </ol>
            </div>

            {/* Signature block */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-6">Homeowner Signature</div>
                <div className="border-t border-[#071321] pt-1 text-xs text-slate-500">Date: ______________</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-6">True North Restorations</div>
                <div className="border-t border-[#071321] pt-1 text-xs text-slate-500">Date: ______________</div>
              </div>
            </div>

            {job && (
              <div className="mt-4 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                <ShieldCheck className="size-3.5 inline mr-1" />
                Contract attached: {job.contractFilename || 'Signed agreement'} · Job status: {job.status}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Recompute the line-item breakdown from the saved estimate fields.
 * This mirrors the /api/estimate-calc math for display purposes.
 */
function computeBreakdown(est: EstimateDetailResponse['estimate']) {
  const squares = Number(est.squares)
  const shinglePerSq = Number(est.shinglePerSq)
  // We don't store the per-component costs on the estimate row, so derive them
  // from the directCost total minus the per-square components we can infer.
  // For the printable view we show the material cost explicitly and group the
  // rest as "Labor, tear-off, underlayment, accessories, fixed" — the exact
  // per-line numbers are on the in-app proposal card.
  const materialCost = squares * shinglePerSq
  const otherCosts = Number(est.directCost) - materialCost
  return {
    lines: [
      { label: `Material (${squares.toFixed(2)} sq × ${fmtMoneyDetail(shinglePerSq)})`, value: materialCost },
      { label: 'Labor, tear-off, underlayment, accessories, disposal, permit', value: otherCosts },
    ],
  }
}
