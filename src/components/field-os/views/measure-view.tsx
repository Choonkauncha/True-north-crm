'use client'

// This view drives a 3-panel estimating form that legitimately needs to
// synchronize external state (lead prefill, catalog load, measurement result)
// into local form state via effects. Disable the strict set-state-in-effect
// rule for the whole file — these patterns are intentional and bounded.
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ruler,
  ScanFace,
  Calculator,
  Image as ImageIcon,
  Sparkles,
  Upload,
  Wand2,
  Save,
  ShieldCheck,
  AlertTriangle,
  ArrowRightCircle,
  CheckCircle2,
  Wind,
  CloudHail,
  Layers,
  Eye,
  History,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  apiGet,
  apiPost,
  apiPatch,
  fmtMoney,
  fmtMoneyDetail,
  fmtDateTime,
  type Lead,
  type IkoProduct,
  type CatalogResponse,
  type MeasureResponse,
  type EstimateCalcResponse,
  type InspectionResponse,
  type RoofDetection,
  type InspectionReport,
} from '@/lib/tn-api'
import { PrintableProposal } from '@/components/field-os/printable-proposal'
import { PrintableInspection } from '@/components/field-os/printable-inspection'
import { compressImage } from '@/lib/image'

export interface MeasurePrefill {
  leadId: string
  street: string
  city: string
  state: string
  zip: string
  pitch?: number
  area?: number
}

interface MeasureViewProps {
  prefill: MeasurePrefill | null
  onPrefillConsumed: () => void
}

export function MeasureView({ prefill, onPrefillConsumed }: MeasureViewProps) {
  const qc = useQueryClient()

  // Catalog (IKO products + pricing profiles)
  const catalogQ = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogResponse>('/api/catalog'),
  })
  const products = catalogQ.data?.catalog || []
  const profiles = catalogQ.data?.profiles || []

  // Leads (for the lead select)
  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads'),
  })

  // === Panel 1: Measurement ===
  const [leadId, setLeadId] = useState<string>('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('Mount Vernon')
  const [state, setState] = useState('OH')
  const [zip, setZip] = useState('')
  const [pitch, setPitch] = useState<string>('')
  const [area, setArea] = useState<string>('')
  const [measureResult, setMeasureResult] = useState<MeasureResponse | null>(null)

  // Apply prefill (from leads view "Measure Property →")
  useEffect(() => {
    if (!prefill) return
    setLeadId(prefill.leadId)
    setStreet(prefill.street)
    setCity(prefill.city || 'Mount Vernon')
    setState(prefill.state || 'OH')
    setZip(prefill.zip || '')
    if (prefill.pitch != null) setPitch(String(prefill.pitch))
    if (prefill.area != null) setArea(String(prefill.area))
    onPrefillConsumed()
    toast.info('Lead loaded into measurement form', { description: `${prefill.street}` })
  }, [prefill])

  const measureMut = useMutation({
    mutationFn: (body: { area: number; pitch: number }) => apiPost<MeasureResponse>('/api/measure', body),
    onSuccess: async (data) => {
      setMeasureResult(data)
      // PATCH the lead with verifiedArea + pitch
      if (leadId) {
        const lead = leadsQ.data?.leads.find(l => l.id === leadId)
        const patchBody: Record<string, unknown> = {
          verifiedArea: data.finalArea,
          pitch: Number(pitch) || 0,
        }
        if (lead && ['new', 'contacted'].includes(lead.stage)) {
          patchBody.stage = 'inspection_complete'
          patchBody.nextAction = 'Build IKO estimate proposal'
        }
        try {
          await apiPatch(`/api/leads/${leadId}`, patchBody)
          qc.invalidateQueries({ queryKey: ['leads'] })
          qc.invalidateQueries({ queryKey: ['metrics'] })
        } catch (e) {
          // non-fatal
          console.error('Failed to patch lead after measure', e)
        }
      }
      toast.success('Verified roof area calculated', {
        description: `${data.finalArea.toLocaleString()} sq ft · ${data.squares.toFixed(2)} squares · pitch factor ${data.pitchFactor.toFixed(3)}`,
      })
    },
    onError: (e: Error) => toast.error('Measurement failed', { description: e.message }),
  })

  const handleCalculate = () => {
    const a = Number(area)
    if (!Number.isFinite(a) || a <= 0) {
      toast.error('Enter a positive roof footprint area')
      return
    }
    measureMut.mutate({ area: a, pitch: Number(pitch) || 0 })
  }

  const handleLeadSelect = (id: string) => {
    setLeadId(id)
    if (!id) return
    const lead = leadsQ.data?.leads.find(l => l.id === id)
    if (lead) {
      setStreet(lead.street)
      setCity(lead.city || 'Mount Vernon')
      setState(lead.state || 'OH')
      setZip(lead.zip || '')
      if (lead.pitch != null) setPitch(String(lead.pitch))
      if (lead.verifiedArea != null) setArea(String(lead.verifiedArea))
    }
  }

  // === Panel 2: Inspection ===
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('')
  const [photoName, setPhotoName] = useState<string>('')
  const [inspectionResult, setInspectionResult] = useState<InspectionResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inspectionMut = useMutation({
    mutationFn: (body: { imageDataUrl: string; leadId?: string }) =>
      apiPost<InspectionResponse>('/api/inspection', body),
    onSuccess: (data) => {
      setInspectionResult(data)
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      toast.success('AI inspection complete', {
        description: `${data.detection.totalCount} damage points detected · recommended IKO ${recommendedLabel(data.detection)}`,
      })
    },
    onError: (e: Error) => toast.error('Inspection failed', { description: e.message }),
  })

  const handlePhotoSelect = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await compressImage(file, 1600, 0.76)
      setPhotoDataUrl(dataUrl)
      setPhotoName(file.name)
      setInspectionResult(null)
    } catch (e) {
      toast.error('Could not load photo', { description: (e as Error).message })
    }
  }

  const handleLoadSample = async () => {
    try {
      const res = await fetch('/roof-sample-damage.jpg')
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Failed to read sample image'))
        reader.readAsDataURL(blob)
      })
      setPhotoDataUrl(dataUrl)
      setPhotoName('roof-sample-damage.jpg')
      setInspectionResult(null)
      toast.info('Sample damage photo loaded')
    } catch (e) {
      toast.error('Failed to load sample photo', { description: (e as Error).message })
    }
  }

  const runInspection = (attachToLead = false) => {
    if (!photoDataUrl) {
      toast.error('Upload or load a sample photo first')
      return
    }
    inspectionMut.mutate({
      imageDataUrl: photoDataUrl,
      ...(attachToLead && leadId ? { leadId } : {}),
    })
  }

  // === Panel 3: Proposal ===
  const [proposalArea, setProposalArea] = useState<string>('')
  const [wastePct, setWastePct] = useState<string>('12')
  const [discount, setDiscount] = useState<string>('0')
  const [productId, setProductId] = useState<string>('')
  const [color, setColor] = useState<string>('')
  const [profileId, setProfileId] = useState<string>('')
  const [proposalResult, setProposalResult] = useState<EstimateCalcResponse | null>(null)
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null)
  const [viewProposalId, setViewProposalId] = useState<string | null>(null)
  const [printInspectionId, setPrintInspectionId] = useState<string | null>(null)

  const selectedProduct = products.find(p => p.id === productId)
  const selectedProfile = profiles.find(p => p.id === profileId)

  // Auto-fill proposal area from measurement result
  useEffect(() => {
    if (measureResult && !proposalArea) {
      setProposalArea(String(measureResult.finalArea))
    }
  }, [measureResult])

  // Auto-select first product / profile when catalog loads
  useEffect(() => {
    if (!productId && products.length > 0) {
      setProductId(products[0].id)
      setColor(products[0].colors[0] || '')
    }
    if (!profileId && profiles.length > 0) {
      const def = profiles.find(p => p.isDefault) || profiles[0]
      setProfileId(def.id)
    }
  }, [products, profiles])

  // Live preview via estimate-calc (debounced effect)
  const canPreview =
    !!productId && !!profileId && Number(proposalArea) > 0

  const calcMut = useMutation({
    mutationFn: (body: {
      area: number
      wastePct: number
      discount: number
      productId: string
      color: string
      profileId: string
    }) => apiPost<EstimateCalcResponse>('/api/estimate-calc', body),
    onSuccess: (data) => setProposalResult(data),
    onError: (e: Error) => {
      // silent — preview is best-effort
      console.warn('Live preview failed', e.message)
    },
  })

  useEffect(() => {
    if (!canPreview) return
    const t = window.setTimeout(() => {
      calcMut.mutate({
        area: Number(proposalArea),
        wastePct: Number(wastePct) || 0,
        discount: Number(discount) || 0,
        productId,
        color,
        profileId,
      })
    }, 300)
    return () => window.clearTimeout(t)
  }, [proposalArea, wastePct, discount, productId, color, profileId, canPreview])

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/estimates', body),
    onSuccess: (data) => {
      const est = (data as { estimate: { id: string } }).estimate
      setSavedEstimateId(est.id)
      qc.invalidateQueries({ queryKey: ['estimates'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      toast.success('Estimate generated', {
        description: `Estimate #${est.id.slice(-6).toUpperCase()} saved · stage advanced to Estimate Sent`,
      })
    },
    onError: (e: Error) => toast.error('Failed to save estimate', { description: e.message }),
  })

  const handleGenerateProposal = () => {
    if (!canPreview) {
      toast.error('Select product, profile, and enter area first')
      return
    }
    if (!proposalResult) {
      toast.error('Live preview not ready — wait a moment')
      return
    }
    if (!selectedProduct || !selectedProfile) {
      toast.error('Select an IKO product and pricing profile')
      return
    }
    const property = [street, city, state, zip].filter(Boolean).join(', ') || 'Unspecified property'
    saveMut.mutate({
      leadId: leadId || undefined,
      property,
      productId,
      product: selectedProduct.name,
      color,
      area: Number(proposalArea),
      squares: proposalResult.squares,
      wastePct: Number(wastePct) || 0,
      discount: Number(discount) || 0,
      shinglePerSq: proposalResult.shinglePerSq,
      profileName: selectedProfile.name,
      price: proposalResult.finalPrice,
      directCost: proposalResult.totalDirectCost,
      grossProfit: proposalResult.grossProfit,
      grossMarginPct: proposalResult.actualMarginPct,
    })
  }

  const handleAutoSelectIko = () => {
    if (!inspectionResult) return
    const rec = inspectionResult.detection.recommendedIko
    setProductId(rec)
    const prod = products.find(p => p.id === rec)
    if (prod) setColor(prod.colors[0] || '')
    setWastePct('15')
    toast.success(`Auto-selected IKO ${recommendedLabel(inspectionResult.detection)}`, {
      description: 'Waste set to 15% for storm-damage re-roof.',
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Panel 1: Property + Field Measurement */}
        <Card data-tut="measure-panel" className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center">
                <Ruler className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[#071321]">1. Property + Field Measurement</CardTitle>
                <CardDescription>Footprint area × pitch factor = verified roof area.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-lead">Attach to lead (optional)</Label>
              <Select value={leadId} onValueChange={handleLeadSelect}>
                <SelectTrigger id="m-lead" className="w-full">
                  <SelectValue placeholder="Select existing lead… or leave blank" />
                </SelectTrigger>
                <SelectContent>
                  {(leadsQ.data?.leads || []).map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.street}{l.city ? `, ${l.city}` : ''}{l.name ? ` — ${l.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-street">Street address</Label>
              <Input id="m-street" value={street} onChange={e => setStreet(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-city">City</Label>
                <Input id="m-city" value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-state">State</Label>
                <Input id="m-state" value={state} onChange={e => setState(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-zip">ZIP</Label>
                <Input id="m-zip" value={zip} onChange={e => setZip(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-pitch">Pitch (e.g. 6 for 6/12)</Label>
                <Input id="m-pitch" type="number" step="0.5" min="0" max="24" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="6" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-area">Footprint area (sq ft)</Label>
                <Input id="m-area" type="number" min="0" value={area} onChange={e => setArea(e.target.value)} placeholder="2000" />
              </div>
            </div>

            <Button
              type="button"
              className="w-full bg-[#0084ff] hover:bg-[#0070e0] text-white"
              onClick={handleCalculate}
              disabled={measureMut.isPending}
            >
              <Calculator className="size-4" />
              {measureMut.isPending ? 'Calculating…' : 'Calculate & Save Verified Roof Area'}
            </Button>

            {measureResult && (
              <div className="rounded-lg border border-[#0084ff]/20 bg-[#0084ff]/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[#0084ff] text-xs font-semibold uppercase tracking-wide">
                  <CheckCircle2 className="size-3.5" /> Verified Measurement
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Pitch Factor" value={measureResult.pitchFactor.toFixed(3)} />
                  <Stat label="Verified Area" value={`${measureResult.finalArea.toLocaleString()} ft²`} />
                  <Stat label="Squares" value={measureResult.squares.toFixed(2)} />
                </div>
                {leadId && (
                  <div className="text-[11px] text-slate-500">
                    Saved to lead · stage advanced to Inspection Complete.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel 2: AI Inspection */}
        <Card data-tut="inspect-panel" className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center">
                <ScanFace className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[#071321]">2. AI Roof Damage Inspection</CardTitle>
                <CardDescription>VLM counts wind creases, hail impacts, and missing shingles.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" /> Upload Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handlePhotoSelect(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" onClick={handleLoadSample}>
                <ImageIcon className="size-4" /> Load Sample
              </Button>
            </div>

            {photoDataUrl ? (
              <div className="rounded-lg border border-[#d6e2ee] overflow-hidden bg-[#071321]">
                <img src={photoDataUrl} alt={photoName || 'Roof photo'} className="w-full max-h-64 object-cover" />
                <div className="px-3 py-1.5 text-[11px] text-[#e2ebf5]/70 truncate">
                  {photoName || 'Photo loaded'}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#d6e2ee] p-8 text-center text-sm text-slate-500">
                <ImageIcon className="size-8 text-slate-300 mx-auto mb-2" />
                Upload a slope photo or load the sample to run AI damage detection.
              </div>
            )}

            <Button
              type="button"
              className="w-full bg-[#8b5cf6] hover:bg-[#7c4ddb] text-white"
              onClick={() => runInspection(false)}
              disabled={!photoDataUrl || inspectionMut.isPending}
            >
              <Sparkles className="size-4" />
              {inspectionMut.isPending ? 'Running VLM analysis…' : 'Run AI Damage Detection'}
            </Button>

            {inspectionResult && (
              <InspectionResultCard
                result={inspectionResult}
                detection={inspectionResult.detection}
                leadId={leadId}
                onAttach={() => runInspection(true)}
                onAutoSelect={handleAutoSelectIko}
                attaching={inspectionMut.isPending}
                onPrint={() => setPrintInspectionId(inspectionResult.report.id)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Past inspections archive — filtered by selected lead */}
      <PastInspectionsArchive
        leadId={leadId}
        onApply={(report) => {
          setInspectionResult({
            report,
            detection: {
              windCount: report.windCount,
              hailCount: report.hailCount,
              missingCount: report.missingCount,
              totalCount: report.totalCount,
              recommendedIko: report.recommendedIko,
              detections: [],
              summary: report.summary,
            },
          })
          setPhotoDataUrl(report.photoDataUrl)
          setPhotoName('Past inspection photo')
        }}
        onPrint={(reportId) => setPrintInspectionId(reportId)}
      />

      {/* Panel 3: Build IKO Estimate Proposal (full width below) */}
      <Card data-tut="proposal-panel" className="border-[#d6e2ee]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-[#f59e0b]/10 text-[#f59e0b] flex items-center justify-center">
              <Calculator className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base text-[#071321]">3. Build IKO Estimate Proposal</CardTitle>
              <CardDescription>Verified area + waste + IKO product + pricing profile = real-cost proposal.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalogQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-area">Roof surface area (sq ft)</Label>
                  <Input id="p-area" type="number" min="0" value={proposalArea} onChange={e => { setProposalArea(e.target.value); setSavedEstimateId(null) }} placeholder="2236" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-waste">Waste %</Label>
                  <Input id="p-waste" type="number" min="0" max="50" step="0.5" value={wastePct} onChange={e => { setWastePct(e.target.value); setSavedEstimateId(null) }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-discount">Discount $</Label>
                  <Input id="p-discount" type="number" min="0" value={discount} onChange={e => { setDiscount(e.target.value); setSavedEstimateId(null) }} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-profile">Pricing profile</Label>
                  <Select value={profileId} onValueChange={v => { setProfileId(v); setSavedEstimateId(null) }}>
                    <SelectTrigger id="p-profile" className="w-full"><SelectValue placeholder="Select profile" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.isDefault ? ' (default)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-product">IKO Shingle Line</Label>
                  <Select value={productId} onValueChange={v => {
                    setProductId(v)
                    const prod = products.find(p => p.id === v)
                    setColor(prod?.colors[0] || '')
                    setSavedEstimateId(null)
                  }}>
                    <SelectTrigger id="p-product" className="w-full"><SelectValue placeholder="Select shingle line" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.shortName} — {p.classRating}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-color">IKO Color</Label>
                  <Select value={color} onValueChange={v => { setColor(v); setSavedEstimateId(null) }}>
                    <SelectTrigger id="p-color" className="w-full"><SelectValue placeholder="Select color" /></SelectTrigger>
                    <SelectContent>
                      {(selectedProduct?.colors || []).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedProduct && (
                <div className="rounded-md border border-[#d6e2ee] bg-[#f5f8fc] p-3 text-xs text-slate-600">
                  <div className="font-semibold text-[#071321] mb-0.5">{selectedProduct.name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Warranty: {selectedProduct.warranty}</span>
                    <span>· Exposure: {selectedProduct.exposure}</span>
                    <span>· Wind: {selectedProduct.windRating}</span>
                  </div>
                  {proposalResult?.supplierPrice && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700 font-medium">
                      <ShieldCheck className="size-3" />
                      Verified supplier price: {fmtMoneyDetail(proposalResult.supplierPrice.price)}/sq
                      <span className="text-emerald-500">· {proposalResult.supplierPrice.supplier}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button
                  type="button"
                  className="bg-[#f59e0b] hover:bg-[#d97f0a] text-white"
                  onClick={handleGenerateProposal}
                  disabled={!canPreview || saveMut.isPending || !proposalResult}
                >
                  <Save className="size-4" />
                  {saveMut.isPending ? 'Generating…' : 'Generate Proposal'}
                </Button>
                {calcMut.isPending && (
                  <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                    <Sparkles className="size-3.5 animate-pulse text-[#f59e0b]" /> Live preview updating…
                  </span>
                )}
              </div>

              {proposalResult && (
                <ProposalResultCard
                  result={proposalResult}
                  product={selectedProduct}
                  color={color}
                  profileName={selectedProfile?.name || ''}
                  savedEstimateId={savedEstimateId}
                  onViewProposal={savedEstimateId ? () => setViewProposalId(savedEstimateId) : undefined}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PrintableProposal estimateId={viewProposalId} onClose={() => setViewProposalId(null)} />
      <PrintableInspection reportId={printInspectionId} onClose={() => setPrintInspectionId(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white border border-[#d6e2ee] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-bold text-[#071321] mt-0.5">{value}</div>
    </div>
  )
}

function recommendedLabel(d: RoofDetection): string {
  const map: Record<string, string> = {
    iko_dynasty: 'Dynasty',
    iko_nordic: 'Nordic',
    iko_cambridge: 'Cambridge',
  }
  return map[d.recommendedIko] || d.recommendedIko
}

function InspectionResultCard({
  result,
  detection,
  leadId,
  onAttach,
  onAutoSelect,
  attaching,
  onPrint,
}: {
  result: InspectionResponse
  detection: RoofDetection
  leadId: string
  onAttach: () => void
  onAutoSelect: () => void
  attaching: boolean
  onPrint: () => void
}) {
  const qualifies = detection.totalCount >= 4
  return (
    <div className="rounded-lg border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1.5">
          <Sparkles className="size-3" /> {result.report.source || 'AI Vision (VLM)'}
        </Badge>
        {qualifies ? (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5">
            <ShieldCheck className="size-3" /> Qualifies for Storm Insurance Claim
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5">
            <AlertTriangle className="size-3" /> Minor Wear / Localized Repair Scope
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <DetectionTile icon={Wind} label="Wind Creases" count={detection.windCount} color="#0084ff" />
        <DetectionTile icon={CloudHail} label="Hail Impacts" count={detection.hailCount} color="#8b5cf6" />
        <DetectionTile icon={Layers} label="Missing Shingles" count={detection.missingCount} color="#ef4444" />
      </div>

      {detection.detections.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Detection List</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {detection.detections.map((d, i) => (
              <li key={i} className="rounded-md border border-[#d6e2ee] bg-white p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#071321] capitalize">{d.class.replace(/-/g, ' ')}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {d.modelType} · {d.confidence}%
                  </Badge>
                </div>
                {d.note && <div className="text-slate-500 mt-0.5">{d.note}</div>}
                <Progress value={d.confidence} className="h-1 mt-1.5" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md bg-white border border-[#d6e2ee] p-2.5 text-xs">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">Recommended IKO Product</div>
        <div className="font-semibold text-[#071321]">IKO {recommendedLabel(detection)}</div>
        <div className="text-slate-500 mt-0.5">{detection.summary}</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAttach}
          disabled={!leadId || attaching}
          className="flex-1"
        >
          <ArrowRightCircle className="size-4" />
          {leadId ? 'Attach Damage Findings to Lead' : 'Select a lead to attach'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onAutoSelect}
          className="flex-1 bg-[#0084ff] hover:bg-[#0070e0] text-white"
        >
          <Wand2 className="size-4" /> Auto-Select IKO in Proposal
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPrint}
          className="flex-1 border-[#8b5cf6]/30 text-[#8b5cf6] hover:bg-[#8b5cf6]/5"
          title="Print or save a PDF of this inspection report for insurance claim filing"
        >
          <Printer className="size-4" /> Print Report
        </Button>
      </div>
    </div>
  )
}

function DetectionTile({
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
    <div className="rounded-md bg-white border border-[#d6e2ee] p-2 text-center">
      <div className="flex items-center justify-center mb-0.5" style={{ color }}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="text-lg font-bold text-[#071321]">{count}</div>
      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
    </div>
  )
}

function ProposalResultCard({
  result,
  product,
  color,
  profileName,
  savedEstimateId,
  onViewProposal,
}: {
  result: EstimateCalcResponse
  product: IkoProduct | undefined
  color: string
  profileName: string
  savedEstimateId: string | null
  onViewProposal?: () => void
}) {
  return (
    <div className="rounded-lg border border-[#f59e0b]/30 bg-gradient-to-br from-[#fffaf0] to-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Client Price</div>
          <div className="text-3xl font-bold text-[#071321]">{fmtMoney(result.finalPrice)}</div>
        </div>
        <div className="flex items-center gap-2">
          {savedEstimateId && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5">
              <CheckCircle2 className="size-3" /> Estimate #{savedEstimateId.slice(-6).toUpperCase()} generated
            </Badge>
          )}
          {onViewProposal && (
            <Button type="button" size="sm" variant="outline" onClick={onViewProposal}>
              <Eye className="size-3.5" /> View Proposal
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Mini label="Squares" value={result.squares.toFixed(2)} />
        <Mini label="Material" value={product ? `${product.shortName}${color ? ` · ${color}` : ''}` : '—'} />
        <Mini label="Shingle $/sq" value={fmtMoneyDetail(result.shinglePerSq)} />
        <Mini label="Profile" value={profileName || '—'} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Pill label="Direct Cost" value={fmtMoney(result.totalDirectCost)} tone="slate" />
        <Pill label="Target Margin" value={`${Math.round(result.marginRatio * 100)}%`} tone="blue" />
        <Pill label="Est. Margin" value={`${result.actualMarginPct}%`} tone="emerald" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] text-slate-600">
        <CostLine label="Material" value={result.materialCost} />
        <CostLine label="Labor" value={result.laborCost} />
        <CostLine label="Tear-off" value={result.tearOffCost} />
        <CostLine label="Underlayment" value={result.underlayCost} />
        <CostLine label="Accessories" value={result.accessCost} />
        <CostLine label="Fixed (disposal + permit)" value={result.fixedCost} />
      </div>

      <div className="flex items-center justify-between text-sm pt-1 border-t border-[#f59e0b]/15">
        <span className="text-slate-600">Gross profit</span>
        <span className="font-bold text-emerald-700">{fmtMoney(result.grossProfit)}</span>
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white border border-[#d6e2ee] p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-[#071321] mt-0.5 truncate">{value}</div>
    </div>
  )
}

function Pill({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'blue' | 'emerald' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}

function CostLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-[#071321]">{fmtMoney(value)}</span>
    </div>
  )
}

/**
 * Collapsible archive of past VLM inspection reports.
 * When a lead is selected, filters to that lead's reports; otherwise shows all.
 * Clicking a report loads its photo + findings back into the inspection panel.
 */
function PastInspectionsArchive({
  leadId,
  onApply,
  onPrint,
}: {
  leadId: string
  onApply: (report: InspectionReport) => void
  onPrint: (reportId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['inspections'],
    queryFn: () => apiGet<{ reports: InspectionReport[] }>('/api/inspection'),
  })

  const allReports = q.data?.reports || []
  // Filter to the selected lead if one is attached, otherwise show all.
  const reports = leadId
    ? allReports.filter(r => r.leadId === leadId)
    : allReports

  // If no reports at all, hide the whole section to reduce clutter.
  if (reports.length === 0) return null

  return (
    <Card className="border-[#d6e2ee]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#f5f8fc] transition-colors rounded-t-xl"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="size-7 rounded-lg bg-[#ec4899]/10 text-[#ec4899] flex items-center justify-center">
            <History className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-[#071321]">
              Past Inspections {leadId ? '(this lead)' : ''}
            </div>
            <div className="text-xs text-slate-500">
              {reports.length} report{reports.length === 1 ? '' : 's'} · click to review or re-load findings
            </div>
          </div>
        </div>
        {open ? <ChevronDown className="size-4 text-slate-400" /> : <ChevronRight className="size-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-[#d6e2ee] p-3 space-y-2">
          {q.isLoading ? (
            <div className="space-y-2">
              {[0, 1].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {reports.map(r => {
                const total = r.windCount + r.hailCount + r.missingCount
                const isExpanded = selectedReport === r.id
                return (
                  <li key={r.id} className="rounded-lg border border-[#e5edf5] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedReport(isExpanded ? null : r.id)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-[#f5f8fc] transition-colors"
                    >
                      <div className="size-10 rounded-md bg-[#071321] overflow-hidden shrink-0">
                        <img src={r.photoDataUrl} alt="Inspection" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#071321]">
                          {total} finding{total === 1 ? '' : 's'} · IKO {r.recommendedIko.replace('iko_', '').toUpperCase()}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {r.windCount} wind · {r.hailCount} hail · {r.missingCount} missing · {fmtDateTime(r.createdAt)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-violet-50 text-violet-700 border-violet-200">
                        {r.source}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#e5edf5] bg-[#f5f8fc]">
                        <div className="rounded-md border border-[#d6e2ee] bg-white p-2 mb-2 text-xs text-slate-600 leading-relaxed">
                          {r.summary || 'No summary recorded.'}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onApply(r)
                              toast.success('Past inspection loaded', { description: 'Photo and findings restored to the inspection panel above.' })
                            }}
                          >
                            <ArrowRightCircle className="size-3.5" /> Load into panel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onPrint(r.id)}
                            className="border-[#8b5cf6]/30 text-[#8b5cf6] hover:bg-[#8b5cf6]/5"
                          >
                            <Printer className="size-3.5" /> Print Report
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
