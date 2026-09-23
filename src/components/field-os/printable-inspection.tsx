'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  Printer,
  X,
  Wind,
  CloudHail,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Sparkles,
  MapPin,
  User,
} from 'lucide-react'
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
  fmtDate,
  fmtDateTime,
  type InspectionReport,
  type Lead,
} from '@/lib/tn-api'

/**
 * Response shape from GET /api/inspection/:id/detail
 * (added this round — see the new route file)
 */
interface InspectionDetailResponse {
  report: InspectionReport
  lead: Pick<Lead, 'id' | 'name' | 'phone' | 'email' | 'street' | 'city' | 'state' | 'zip' | 'source' | 'territory'> | null
}

interface PrintableInspectionProps {
  reportId: string | null
  onClose: () => void
}

export function PrintableInspection({ reportId, onClose }: PrintableInspectionProps) {
  const q = useQuery({
    queryKey: ['inspection-detail', reportId],
    queryFn: () => apiGet<InspectionDetailResponse>(`/api/inspection/${reportId}/detail`),
    enabled: !!reportId,
  })

  // Lock body scroll while the printable dialog is open
  useEffect(() => {
    if (reportId) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [reportId])

  const open = !!reportId
  const data = q.data
  const report = data?.report
  const lead = data?.lead
  const qualifies = (report?.totalCount ?? 0) >= 4

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          Printable inspection report {report ? `#${report.id.slice(-6).toUpperCase()}` : ''}
        </DialogTitle>

        {/* Action bar (screen-only, hidden on print) */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#d6e2ee] px-5 py-3 flex items-center justify-between print:hidden">
          <div className="text-sm font-semibold text-[#071321]">
            {q.isLoading ? 'Loading report…' : report ? `Inspection Report #${report.id.slice(-6).toUpperCase()}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#8b5cf6] hover:bg-[#7c4ddb] text-white"
              onClick={() => window.print()}
              disabled={!report}
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
            Failed to load inspection report. {(q.error as Error)?.message}
          </div>
        ) : report ? (
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
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[#8b5cf6] font-semibold">AI Roof Damage Inspection Report</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Mount Vernon, Knox County · OH</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Report #</div>
                <div className="font-mono font-bold text-[#071321]">#{report.id.slice(-6).toUpperCase()}</div>
                <div className="text-[10px] text-slate-500 mt-1">{fmtDateTime(report.createdAt)}</div>
                <Badge variant="outline" className="mt-1 bg-violet-50 text-violet-700 border-violet-200 text-[10px] gap-1">
                  <Sparkles className="size-2.5" /> {report.source}
                </Badge>
              </div>
            </div>

            {/* Claim eligibility banner */}
            <div className={`mt-4 rounded-lg p-3 border ${qualifies ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`flex items-center gap-2 text-sm font-semibold ${qualifies ? 'text-emerald-800' : 'text-amber-800'}`}>
                {qualifies ? <ShieldCheck className="size-4" /> : <AlertTriangle className="size-4" />}
                {qualifies
                  ? 'Qualifies for Storm Insurance Claim'
                  : 'Minor Wear / Localized Repair Scope'}
              </div>
              <div className={`text-xs mt-0.5 ${qualifies ? 'text-emerald-700' : 'text-amber-700'}`}>
                {qualifies
                  ? `${report.totalCount} verified damage points detected. Recommend filing a storm damage claim with the homeowner's insurance carrier.`
                  : 'Below the 4-damage-point threshold for a full storm claim. Recommend localized repair or maintenance scope.'}
              </div>
            </div>

            {/* Property + customer */}
            {lead && (
              <div className="grid grid-cols-2 gap-4 mt-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Property</div>
                  <div className="text-sm text-[#071321] flex items-start gap-1.5">
                    <MapPin className="size-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span>
                      {lead.street}{lead.city ? `, ${lead.city}` : ''}{lead.state ? `, ${lead.state}` : ''}{lead.zip ? ` ${lead.zip}` : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Customer</div>
                  <div className="text-sm text-[#071321] flex items-center gap-1.5">
                    <User className="size-3.5 text-slate-400" />
                    {lead.name || 'Unknown'}
                    {lead.phone ? <span className="text-slate-500">· {lead.phone}</span> : null}
                  </div>
                </div>
              </div>
            )}

            {/* Inspection photo */}
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5 flex items-center gap-1.5">
                <Camera className="size-3" /> Inspection Photo
              </div>
              <div className="rounded-lg border border-[#d6e2ee] overflow-hidden bg-[#071321]">
                <img src={report.photoDataUrl} alt="Roof inspection" className="w-full max-h-72 object-contain" />
              </div>
            </div>

            {/* Damage summary tiles */}
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Damage Summary</div>
              <div className="grid grid-cols-4 gap-2">
                <SummaryTile icon={Wind} label="Wind Creases" count={report.windCount} color="#0084ff" />
                <SummaryTile icon={CloudHail} label="Hail Impacts" count={report.hailCount} color="#8b5cf6" />
                <SummaryTile icon={Layers} label="Missing Shingles" count={report.missingCount} color="#ef4444" />
                <SummaryTile icon={Sparkles} label="Total Findings" count={report.totalCount} color="#f59e0b" />
              </div>
            </div>

            {/* Inspector summary */}
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Inspector Summary</div>
              <div className="rounded-lg border border-[#d6e2ee] bg-[#f5f8fc] p-3 text-sm text-slate-700 leading-relaxed">
                {report.summary || 'No summary recorded.'}
              </div>
            </div>

            {/* Recommended action */}
            <div className="mt-5 rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 p-4">
              <div className="text-[10px] uppercase tracking-wide text-[#8b5cf6] font-semibold mb-1">Recommended Specification</div>
              <div className="font-bold text-[#071321] text-base">
                IKO {report.recommendedIko.replace('iko_', '').charAt(0).toUpperCase() + report.recommendedIko.replace('iko_', '').slice(1)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {report.recommendedIko === 'iko_nordic'
                  ? 'Class 4 impact-resistant shingle — insurance-premium friendly for hail-prone Central Ohio territories.'
                  : report.recommendedIko === 'iko_dynasty'
                  ? 'Performance architectural shingle with ArmourZone — engineered for Ohio storm resistance and high-wind warranty up to 130 MPH.'
                  : 'Value architectural laminated shingle — proven Ohio performer for residential re-roof projects.'}
              </div>
            </div>

            {/* Terms */}
            <div className="mt-6 pt-4 border-t border-[#d6e2ee]">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">Inspector Notes</div>
              <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
                <li>This report was generated by AI Vision (VLM) analysis of the inspection photo.</li>
                <li>Damage counts reflect visible conditions at the time of inspection.</li>
                <li>Recommend filing with the homeowner&apos;s insurance carrier if 4+ damage points were detected.</li>
                <li>Final repair scope should be confirmed by a licensed roofing contractor on-site.</li>
              </ol>
            </div>

            {/* Signature block */}
            <div className="mt-6 grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-6">True North Inspector</div>
                <div className="border-t border-[#071321] pt-1 text-xs text-slate-500">Date: ______________</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-6">Homeowner Acknowledgement</div>
                <div className="border-t border-[#071321] pt-1 text-xs text-slate-500">Date: ______________</div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: typeof Wind
  label: string
  count: number
  color: string
}) {
  return (
    <div className="rounded-lg border border-[#d6e2ee] bg-white p-3 text-center">
      <div className="flex items-center justify-center mb-1" style={{ color }}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="text-2xl font-bold text-[#071321]">{count}</div>
      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
    </div>
  )
}
