'use client'

/* eslint-disable react-hooks/set-state-in-effect */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Map as MapIcon,
  MapPin,
  ChevronRight,
  ChevronDown,
  Compass,
  Layers,
  Route,
  Plus,
  Minus,
  X,
  Trash2,
  Crosshair,
  Building2,
  Signpost,
  Eye,
  Satellite,
  Loader2,
  ExternalLink,
  Save,
  CheckCircle2,
  FolderOpen,
  Check,
  SkipForward,
  Clock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import ReactMarkdown from 'react-markdown'
import { LeafletMap, type LeafletMapBounds } from '@/components/field-os/views/leaflet-map'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  stageBadgeClasses,
  stageLabel,
  type Lead,
  type CanvassRoute,
  type CanvassStop,
  type AerialScan,
} from '@/lib/tn-api'

// ─── Types ───────────────────────────────────────────────────────────────────────

type Quadrant = 'N' | 'S' | 'E' | 'W' | 'C'

interface TownNode {
  name: string
  leads: Lead[]
  quadrants: Record<Quadrant, QuadrantNode>
  totalLeads: number
}

interface QuadrantNode {
  key: Quadrant
  label: string
  leads: Lead[]
  roads: Record<string, RoadNode>
}

interface RoadNode {
  name: string
  leads: Lead[]
}

interface RouteStop {
  leadId: string
  street: string
  name: string
  lat: number
  lng: number
}

interface GeocodeResult {
  lat: number
  lng: number
}

// ─── Quadrant config ─────────────────────────────────────────────────────────────

const QUADRANT_LABELS: Record<Quadrant, string> = {
  N: 'North', S: 'South', E: 'East', W: 'West', C: 'Central',
}

const QUADRANT_COLORS: Record<Quadrant, string> = {
  N: '#0084ff', S: '#10b981', E: '#f59e0b', W: '#8b5cf6', C: '#ef4444',
}

// ─── Verified property coordinates ───────────────────────────────────────────────
// Coordinates are written to the lead by the server-side address verification flow.
// The browser never invents, randomizes, or city-center-falls-back to a property pin.

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  return s.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
}

/**
 * Determine the quadrant of a lead within its town using geocoded coordinates.
 * Falls back to street-name heuristics, then deterministic hash.
 */
function getQuadrant(lead: Lead, geo?: GeocodeResult | null, townGeo?: GeocodeResult | null): Quadrant {
  // If we have geocoded coordinates, use lat/lng relative to town center
  if (geo && townGeo) {
    const latDiff = geo.lat - townGeo.lat
    const lngDiff = geo.lng - townGeo.lng
    // Use the larger axis difference to determine the dominant direction
    if (Math.abs(latDiff) >= Math.abs(lngDiff)) {
      return latDiff >= 0 ? 'N' : 'S'
    } else {
      return lngDiff >= 0 ? 'E' : 'W'
    }
  }
  // Fallback: check street name for directional prefixes
  const addr = `${lead.street} ${lead.city}`.toLowerCase()
  if (/\b(north|n\b)\s/.test(addr) || addr.startsWith('n ')) return 'N'
  if (/\b(south|s\b)\s/.test(addr) || addr.startsWith('s ')) return 'S'
  if (/\b(east|e\b)\s/.test(addr) || addr.startsWith('e ')) return 'E'
  if (/\b(west|w\b)\s/.test(addr) || addr.startsWith('w ')) return 'W'
  return (['N', 'E', 'S', 'W'] as Quadrant[])[Math.abs(hashStr(lead.id)) % 4]
}

function extractRoadName(street: string): string {
  return street.replace(/^\d+\s*/, '').trim() || street
}

// ─── Build territory tree ────────────────────────────────────────────────────────

function buildTerritoryTree(leads: Lead[], geocodedLeads: Map<string, GeocodeResult>, townCenters: Map<string, GeocodeResult>): TownNode[] {
  const townMap = new Map<string, Lead[]>()
  for (const lead of leads) {
    const town = lead.city || 'Unknown'
    if (!townMap.has(town)) townMap.set(town, [])
    townMap.get(town)!.push(lead)
  }

  return Array.from(townMap.entries()).map(([townName, townLeads]) => {
    const townGeo = townCenters.get(townName) || null
    const quads: Record<Quadrant, QuadrantNode> = {
      N: { key: 'N', label: 'North', leads: [], roads: {} },
      S: { key: 'S', label: 'South', leads: [], roads: {} },
      E: { key: 'E', label: 'East', leads: [], roads: {} },
      W: { key: 'W', label: 'West', leads: [], roads: {} },
      C: { key: 'C', label: 'Central', leads: [], roads: {} },
    }
    for (const lead of townLeads) {
      const geo = geocodedLeads.get(lead.id) || null
      const q = getQuadrant(lead, geo, townGeo)
      quads[q].leads.push(lead)
      const roadName = extractRoadName(lead.street)
      if (!quads[q].roads[roadName]) quads[q].roads[roadName] = { name: roadName, leads: [] }
      quads[q].roads[roadName].leads.push(lead)
    }
    const activeQuads = Object.fromEntries(
      Object.entries(quads).filter(([, q]) => q.leads.length > 0)
    ) as Record<Quadrant, QuadrantNode>
    return { name: townName, leads: townLeads, quadrants: activeQuads, totalLeads: townLeads.length }
  }).sort((a, b) => b.totalLeads - a.totalLeads)
}

// ─── Map bounds ─────────────────────────────────────────────────────────────────

export type MapBounds = LeafletMapBounds

function computeBounds(
  geocodedLeads: Map<string, GeocodeResult>,
  leads: Lead[],
  drillLevel: number,
): MapBounds | null {
  const geoLeads = leads.filter(lead => geocodedLeads.has(lead.id))
  if (geoLeads.length === 0) return null

  const coords = geoLeads.map(lead => geocodedLeads.get(lead.id)!)
  if (coords.length === 1) {
    const c = coords[0]
    const pad = 0.003
    return { minLat: c.lat - pad, maxLat: c.lat + pad, minLng: c.lng - pad, maxLng: c.lng + pad }
  }

  const lats = coords.map(c => c.lat)
  const lngs = coords.map(c => c.lng)
  const padding = [0.008, 0.005, 0.003, 0.0015, 0.001][drillLevel] ?? 0.005
  return {
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
  }
}

function getPinPercent(
  lat: number,
  lng: number,
  bounds: MapBounds,
): { x: number; y: number } {
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.000001)
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.000001)
  const x = ((lng - bounds.minLng) / lngSpan) * 100
  const y = ((bounds.maxLat - lat) / latSpan) * 100
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(5, Math.min(92, y)) }
}

// ─── Main component ──────────────────────────────────────────────────────────────

interface RouteMapViewProps {
  onOpenLead?: (leadId: string) => void
}

export function RouteMapView({ onOpenLead, canUseAi = true }: RouteMapViewProps & { canUseAi?: boolean }) {
  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads'),
  })

  const leads = leadsQ.data?.leads || []

  const [selectedTown, setSelectedTown] = useState<string | null>(null)
  const [selectedQuadrant, setSelectedQuadrant] = useState<Quadrant | null>(null)
  const [selectedRoad, setSelectedRoad] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<'satellite' | 'road'>('road')
  const [routeStops, setRouteStops] = useState<RouteStop[]>([])
  const [selectedLeadForMap, setSelectedLeadForMap] = useState<string | null>(null)
  const [geocodedLeads, setGeocodedLeads] = useState<Map<string, GeocodeResult>>(new Map())
  const [verifyingAddressId, setVerifyingAddressId] = useState<string | null>(null)
  const [townCenters, setTownCenters] = useState<Map<string, GeocodeResult>>(new Map())
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null)
  const [stopStatuses, setStopStatuses] = useState<Record<string, 'pending' | 'visited' | 'skipped'>>({})
  const [deleteRouteId, setDeleteRouteId] = useState<string | null>(null)
  const [expandedRoad, setExpandedRoad] = useState<string | null>(null)
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [aerialScans, setAerialScans] = useState<Map<string, { condition: string; score: number; findings: string; indicators: string[] }>>(new Map())
  const [scanResultForLead, setScanResultForLead] = useState<string | null>(null)
  const qc = useQueryClient()

  // Fetch saved routes
  const savedRoutesQ = useQuery({
    queryKey: ['routes'],
    queryFn: () => apiGet<{ routes: CanvassRoute[] }>('/api/routes'),
  })

  // Fetch existing aerial scans
  const scansQ = useQuery({
    queryKey: ['aerial-scans'],
    queryFn: () => apiGet<{ scans: AerialScan[] }>('/api/aerial-scan'),
    enabled: canUseAi,
  })

  // Populate aerialScans map when scans load
  useEffect(() => {
    if (scansQ.data?.scans) {
      const scanMap = new Map<string, { condition: string; score: number; findings: string; indicators: string[] }>()
      // Keep only the latest scan per leadId
      for (const scan of scansQ.data.scans) {
        if (scan.leadId) {
          scanMap.set(scan.leadId, {
            condition: scan.condition,
            score: scan.conditionScore,
            findings: scan.findings,
            indicators: scan.indicators ? JSON.parse(scan.indicators) : [],
          })
        }
      }
      setAerialScans(scanMap)
    }
  }, [scansQ.data])

  const towns = buildTerritoryTree(leads, geocodedLeads, townCenters)

  const unverifiedLeads = leads.filter(l => l.geocodeStatus !== 'verified' || l.latitude == null || l.longitude == null)

  const activeTown = towns.find(t => t.name === selectedTown)
  const activeQuadrant = activeTown && selectedQuadrant ? activeTown.quadrants[selectedQuadrant] : null
  const activeRoad = activeQuadrant && selectedRoad ? activeQuadrant.roads[selectedRoad] : null

  const mapLeads = activeRoad?.leads || activeQuadrant?.leads || activeTown?.leads || leads

  // Drill-down level for progressive zoom (0=all, 1=town, 2=quadrant, 3=road, 4=address)
  const drillLevel = selectedRoad ? 3 : selectedQuadrant ? 2 : selectedTown ? 1 : 0

  // Compute map bounds for the current drill-down level
  const mapBounds = computeBounds(geocodedLeads, mapLeads, drillLevel)

  // Segmentation color: the quadrant color when a quadrant is selected,
  // or the town's primary quadrant color when a town is selected
  const segmentColor = activeQuadrant
    ? QUADRANT_COLORS[activeQuadrant.key]
    : activeTown
      ? QUADRANT_COLORS[Object.keys(activeTown.quadrants)[0] as Quadrant] || '#0084ff'
      : '#0084ff'

  // Geocoded visible leads with their pin positions
  const visiblePins = mapBounds ? mapLeads.filter(l => geocodedLeads.has(l.id)).map(l => { const geo = geocodedLeads.get(l.id)!; const pos = getPinPercent(geo.lat, geo.lng, mapBounds); return { lead: l, pos, geo } }) : []

  // Route stop positions for the connecting line
  const routePinPositions = mapBounds && routeStops.length >= 2 ? routeStops.filter(s => geocodedLeads.has(s.leadId)).map(s => {
    const geo = geocodedLeads.get(s.leadId)!
    return getPinPercent(geo.lat, geo.lng, mapBounds)
  }) : []

  // Use only server-verified coordinates stored on each lead.
  useEffect(() => {
    const next = new Map<string, GeocodeResult>()
    for (const lead of leads) {
      if (lead.geocodeStatus === 'verified' && lead.latitude != null && lead.longitude != null) {
        next.set(lead.id, { lat: lead.latitude, lng: lead.longitude })
      }
    }
    setGeocodedLeads(next)

    // Town centers are derived from verified property coordinates, never from a
    // generic city-center geocode. This keeps quadrant visualization grounded in
    // the actual territory represented by the company's verified properties.
    const nextCenters = new Map<string, GeocodeResult>()
    const groups = new Map<string, GeocodeResult[]>()
    for (const lead of leads) {
      const geo = next.get(lead.id)
      if (!geo) continue
      const town = lead.city || 'Unknown'
      const arr = groups.get(town) || []
      arr.push(geo)
      groups.set(town, arr)
    }
    for (const [town, coords] of groups) {
      nextCenters.set(town, {
        lat: coords.reduce((sum, c) => sum + c.lat, 0) / coords.length,
        lng: coords.reduce((sum, c) => sum + c.lng, 0) / coords.length,
      })
    }
    setTownCenters(nextCenters)
  }, [leads])

  const verifyAddress = async (lead: Lead) => {
    setVerifyingAddressId(lead.id)
    try {
      await apiPost(`/api/leads/${lead.id}/verify-address`, {})
      await qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Address verified', { description: lead.street })
    } catch (e) {
      toast.error('Address needs review', { description: e instanceof Error ? e.message : 'Could not verify this property address.' })
    } finally {
      setVerifyingAddressId(null)
    }
  }

  const toggleRouteStop = useCallback((lead: Lead) => {
    const geo = geocodedLeads.get(lead.id)
    if (!geo) return
    setRouteStops(prev => {
      const exists = prev.find(s => s.leadId === lead.id)
      if (exists) return prev.filter(s => s.leadId !== lead.id)
      return [...prev, { leadId: lead.id, street: lead.street, name: lead.name || 'Unknown', lat: geo.lat, lng: geo.lng }]
    })
  }, [geocodedLeads])

  const moveStop = (index: number, dir: 'up' | 'down') => {
    setRouteStops(prev => {
      const next = [...prev]
      const target = dir === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ─── Saved route mutations ────────────────────────────────────────────────────

  const saveRouteMut = useMutation({
    mutationFn: (body: { name: string; town: string; stops: RouteStop[] }) =>
      apiPost<{ route: CanvassRoute }>('/api/routes', body),
    onSuccess: () => {
      toast.success('Route saved!')
      qc.invalidateQueries({ queryKey: ['routes'] })
      setSaveDialogOpen(false)
      setRouteName('')
    },
    onError: (e: Error) => toast.error('Failed to save route', { description: e.message }),
  })

  const deleteRouteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/routes/${id}`),
    onSuccess: () => {
      toast.success('Route deleted')
      qc.invalidateQueries({ queryKey: ['routes'] })
      setDeleteRouteId(null)
    },
    onError: (e: Error) => toast.error('Failed to delete route', { description: e.message }),
  })

  const completeRouteMut = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/routes/${id}`, { status: 'completed' }),
    onSuccess: () => {
      toast.success('Route marked as completed!')
      qc.invalidateQueries({ queryKey: ['routes'] })
      setActiveRouteId(null)
      setRouteStops([])
      setStopStatuses({})
    },
    onError: (e: Error) => toast.error('Failed to complete route', { description: e.message }),
  })

  const updateStopMut = useMutation({
    mutationFn: ({ routeId, stopId, status }: { routeId: string; stopId: string; status: 'visited' | 'skipped' }) =>
      apiPatch(`/api/routes/${routeId}/stops/${stopId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
    onError: (e: Error) => toast.error('Failed to update stop', { description: e.message }),
  })

  const handleSaveRoute = () => {
    if (!routeName.trim()) {
      toast.error('Enter a route name')
      return
    }
    saveRouteMut.mutate({
      name: routeName.trim(),
      town: activeTown?.name || '',
      stops: routeStops,
    })
  }

  const loadRoute = (route: CanvassRoute) => {
    setRouteStops(route.stops.map(s => ({
      leadId: s.leadId || s.id,
      street: s.street,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    })))
    setActiveRouteId(route.id)
    const statuses: Record<string, 'pending' | 'visited' | 'skipped'> = {}
    route.stops.forEach(s => { statuses[s.leadId || s.id] = s.status as 'pending' | 'visited' | 'skipped' })
    setStopStatuses(statuses)
    toast.success(`Loaded route: ${route.name}`, { description: `${route.stops.length} stops` })
  }

  const markStopVisited = (stopId: string, status: 'visited' | 'skipped') => {
    setStopStatuses(prev => ({ ...prev, [stopId]: status }))
    if (activeRouteId) {
      // Find the stop's database ID from the saved route
      const route = savedRoutesQ.data?.routes.find(r => r.id === activeRouteId)
      const stop = route?.stops.find(s => (s.leadId || s.id) === stopId)
      if (stop) {
        updateStopMut.mutate({ routeId: activeRouteId, stopId: stop.id, status })
      }
    }
  }


  const breadcrumb = [
    { label: 'All Towns', onClick: () => { setSelectedTown(null); setSelectedQuadrant(null); setSelectedRoad(null) } },
    selectedTown && { label: selectedTown, onClick: () => { setSelectedQuadrant(null); setSelectedRoad(null) } },
    selectedQuadrant && activeQuadrant && { label: activeQuadrant.label, onClick: () => setSelectedRoad(null) },
    selectedRoad && { label: selectedRoad, onClick: () => {} },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void }>

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button type="button" onClick={() => setMapMode('road')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${mapMode === 'road' ? 'bg-[#071321] text-white' : 'text-slate-600 hover:bg-[#f5f8fc]'}`}>
              <Signpost className="size-3.5" /> Road Map
            </button>
            <button type="button" onClick={() => setMapMode('satellite')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${mapMode === 'satellite' ? 'bg-[#071321] text-white' : 'text-slate-600 hover:bg-[#f5f8fc]'}`}>
              <Satellite className="size-3.5" /> Satellite
            </button>
          </div>
          {/* AI Suggest Routes button */}
          {canUseAi && <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setAiSuggesting(true)
              setAiSuggestion(null)
              try {
                const res = await fetch('/api/routes/suggest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ town: activeTown?.name || null }),
                })
                const data = await res.json()
                if (data.suggestion) setAiSuggestion(data.suggestion)
                else toast.error('Failed to get suggestions')
              } catch (e) {
                toast.error('AI suggestion failed')
              }
              setAiSuggesting(false)
            }}
            disabled={aiSuggesting}
            className="border-violet-300 text-violet-600 hover:bg-violet-50"
          >
            {aiSuggesting ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            AI Suggest Routes
          </Button>}
          {/* Scan Visible Roofs button */}
          {canUseAi && <Button
            size="sm"
            variant="outline"
            disabled={scanning || mapLeads.filter(l => geocodedLeads.has(l.id) && !aerialScans.has(l.id)).length === 0}
            onClick={async () => {
              const allGeocodedLeadIds = mapLeads.filter(l => geocodedLeads.has(l.id)).map(l => l.id)
              const unscannedLeadIds = allGeocodedLeadIds.filter(id => !aerialScans.has(id))
              const geocodedLeadIds = (unscannedLeadIds.length > 0 ? unscannedLeadIds : allGeocodedLeadIds).slice(0, 20)
              if (geocodedLeadIds.length === 0) return
              if (unscannedLeadIds.length > 20) {
                toast.info('Scanning first 20 unscanned roofs', { description: `${unscannedLeadIds.length - 20} more visible properties remain.` })
              }
              setScanning(true)
              setScanProgress({ done: 0, total: geocodedLeadIds.length })
              try {
                const res = await fetch('/api/aerial-scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ leadIds: geocodedLeadIds }),
                })
                const data = await res.json()
                if (data.results) {
                  // Update the scans map with results
                  const newScans = new Map(aerialScans)
                  let done = 0
                  for (const result of data.results) {
                    if (result.success) {
                      newScans.set(result.leadId, {
                        condition: result.condition,
                        score: result.score,
                        findings: '',
                        indicators: [],
                      })
                    }
                    done++
                    setScanProgress({ done, total: geocodedLeadIds.length })
                  }
                  setAerialScans(newScans)
                  qc.invalidateQueries({ queryKey: ['aerial-scans'] })
                  const poorCount = data.results.filter((r: any) => r.condition === 'poor').length
                  const fairCount = data.results.filter((r: any) => r.condition === 'fair').length
                  toast.success(`Scanned ${data.results.filter((r: any) => r.success).length} roofs`, {
                    description: `${poorCount} poor, ${fairCount} fair, ${data.results.filter((r: any) => r.condition === 'good').length} good`,
                  })
                }
              } catch (e) {
                toast.error('Aerial scan failed')
              }
              setScanning(false)
              setScanProgress(null)
            }}
            className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
          >
            {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <Satellite className="size-3.5" />}
            {scanning && scanProgress ? `Scanning ${scanProgress.done}/${scanProgress.total}` : 'Scan Roofs'}
          </Button>}
        </div>
        <div className="flex items-center gap-2">
          {unverifiedLeads.length > 0 && <Badge variant="outline" className="gap-1.5 bg-amber-50 border-amber-200 text-amber-700"><MapPin className="size-3" /> {unverifiedLeads.length} unverified</Badge>}
          {routeStops.length > 0 && (
            <>
              <Badge variant="outline" className="gap-1.5 bg-[#0084ff]/5 border-[#0084ff]/30 text-blue-500"><Route className="size-3" /> {routeStops.length} stop{routeStops.length === 1 ? '' : 's'}</Badge>
              <Button size="sm" variant="ghost" onClick={() => { setRouteStops([]); setActiveRouteId(null); setStopStatuses({}) }} className="text-red-500 hover:text-red-600 h-7"><Trash2 className="size-3.5" /> Clear</Button>
            </>
          )}
        </div>
      </div>

      {/* AI Suggestion panel */}
      <AnimatePresence>
        {aiSuggestion && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
            <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                    <span className="size-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"><Sparkles className="size-4" /></span>
                    AI Route Recommendations
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setAiSuggestion(null)} className="h-7 text-slate-400"><X className="size-3.5" /></Button>
                </div>
                <CardDescription>Based on 6 months of historical data, lead conversion patterns, and territory performance.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="prose prose-sm max-w-none text-slate-700 [&_*:first-child]:mt-0 [&_*:last-child]:mb-0">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h3 className="text-sm font-bold text-slate-800 mt-3 mb-1">{children}</h3>,
                      h2: ({ children }) => <h3 className="text-sm font-bold text-slate-800 mt-3 mb-1">{children}</h3>,
                      h3: ({ children }) => <h4 className="text-sm font-semibold text-slate-800 mt-2 mb-1">{children}</h4>,
                      p: ({ children }) => <p className="text-xs leading-relaxed my-1.5">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 text-xs space-y-0.5 my-1.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 text-xs space-y-0.5 my-1.5">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                    }}
                  >
                    {aiSuggestion}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Drill-down panel */}
        <div className="lg:col-span-2 space-y-4">
          {breadcrumb.length > 1 && (
            <div className="flex items-center gap-1 text-xs flex-wrap">
              {breadcrumb.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3 text-slate-300" />}
                  <button type="button" onClick={crumb.onClick} className={`font-medium ${i === breadcrumb.length - 1 ? 'text-slate-800 font-bold' : 'text-blue-500 hover:underline'}`}>{crumb.label}</button>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!selectedTown && (
              <motion.div key="towns" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-slate-800"><Building2 className="size-4 text-blue-500" /> Towns</CardTitle><CardDescription>Select a town to drill into quadrants.</CardDescription></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {towns.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No leads yet.</p> : towns.map(town => (
                      <button key={town.name} type="button" onClick={() => setSelectedTown(town.name)} className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-[#e5edf5] bg-white hover:border-[#0084ff]/40 hover:shadow-sm transition-all text-left group">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-gradient-to-br from-[#0084ff] to-[#40d4ff] text-white flex items-center justify-center font-bold text-sm shadow-sm">{town.name.charAt(0)}</div>
                          <div><div className="text-sm font-semibold text-slate-800">{town.name}</div><div className="text-xs text-slate-500">{town.totalLeads} lead{town.totalLeads === 1 ? '' : 's'} · {Object.keys(town.quadrants).length} quadrant{Object.keys(town.quadrants).length === 1 ? '' : 's'}</div></div>
                        </div>
                        <div className="flex gap-0.5">{Object.entries(town.quadrants).slice(0, 4).map(([q]) => <span key={q} className="size-2 rounded-full" style={{ backgroundColor: QUADRANT_COLORS[q as Quadrant] }} />)}</div>
                        <ChevronRight className="size-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {selectedTown && !selectedQuadrant && activeTown && (
              <motion.div key="quadrants" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-slate-800"><Compass className="size-4 text-blue-500" /> {activeTown.name} — Quadrants</CardTitle><CardDescription>Choose a quadrant to see roads.</CardDescription></CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {Object.values(activeTown.quadrants).map(qNode => (
                      <button key={qNode.key} type="button" onClick={() => setSelectedQuadrant(qNode.key)} className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-[#e5edf5] bg-white hover:shadow-sm transition-all text-left" style={{ borderLeftWidth: 4, borderLeftColor: QUADRANT_COLORS[qNode.key] }}>
                        <div className="flex items-center gap-2.5">
                          <span className="size-8 rounded-lg flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: QUADRANT_COLORS[qNode.key] }}>{qNode.key}</span>
                          <div><div className="text-sm font-semibold text-slate-800">{qNode.label}</div><div className="text-xs text-slate-500">{qNode.leads.length} lead{qNode.leads.length === 1 ? '' : 's'} · {Object.keys(qNode.roads).length} road{Object.keys(qNode.roads).length === 1 ? '' : 's'}</div></div>
                        </div>
                        <ChevronRight className="size-4 text-slate-300" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {selectedQuadrant && !selectedRoad && activeQuadrant && (
              <motion.div key="roads" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                      <span className="size-6 rounded-md flex items-center justify-center font-bold text-xs text-white" style={{ backgroundColor: QUADRANT_COLORS[activeQuadrant.key] }}>{activeQuadrant.key}</span>
                      {activeQuadrant.label} — Roads
                    </CardTitle>
                    <CardDescription>Click a road to expand addresses. Check boxes to add to route.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-1.5">
                    {/* Select all button */}
                    {Object.values(activeQuadrant.roads).some(r => r.leads.some(l => geocodedLeads.has(l.id) && !routeStops.some(s => s.leadId === l.id))) && (
                      <Button size="sm" variant="outline" className="w-full mb-2 text-xs" onClick={() => {
                        Object.values(activeQuadrant.roads).forEach(road => {
                          road.leads.forEach(lead => {
                            if (geocodedLeads.has(lead.id) && !routeStops.some(s => s.leadId === lead.id)) {
                              toggleRouteStop(lead)
                            }
                          })
                        })
                      }}>
                        <Plus className="size-3.5" /> Add all addresses to route
                      </Button>
                    )}
                    {Object.values(activeQuadrant.roads).map(road => {
                      const isExpanded = expandedRoad === road.name
                      const roadLeadIds = road.leads.map(l => l.id)
                      const allInRoute = roadLeadIds.every(id => routeStops.some(s => s.leadId === id))
                      const someInRoute = roadLeadIds.some(id => routeStops.some(s => s.leadId === id))
                      return (
                        <div key={road.name} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                          {/* Road header — click to expand/collapse */}
                          <button
                            type="button"
                            onClick={() => setExpandedRoad(isExpanded ? null : road.name)}
                            className="w-full flex items-center justify-between gap-3 p-2.5 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2.5">
                              <Signpost className="size-4 text-slate-400" />
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{road.name}</div>
                                <div className="text-xs text-slate-500">
                                  {road.leads.length} address{road.leads.length === 1 ? '' : 'es'}
                                  {someInRoute && <span className="ml-1 text-blue-500">· {roadLeadIds.filter(id => routeStops.some(s => s.leadId === id)).length} in route</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Quick add-all toggle */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); road.leads.forEach(lead => { if (geocodedLeads.has(lead.id)) toggleRouteStop(lead) }) }}
                                className={`size-6 rounded flex items-center justify-center transition-colors ${allInRoute ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-blue-100'}`}
                                title={allInRoute ? 'Remove all from route' : 'Add all to route'}
                              >
                                {allInRoute ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                              </button>
                              <ChevronDown className={`size-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                          {/* Expanded address list with checkboxes */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="border-t border-slate-100 overflow-hidden"
                              >
                                <div className="p-2 space-y-1 bg-slate-50/50">
                                  {road.leads.map(lead => {
                                    const inRoute = routeStops.some(s => s.leadId === lead.id)
                                    const isGeocoded = geocodedLeads.has(lead.id)
                                    const scan = aerialScans.get(lead.id)
                                    return (
                                      <label
                                        key={lead.id}
                                        className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${inRoute ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'} ${!isGeocoded ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={inRoute}
                                          disabled={!isGeocoded}
                                          onChange={() => toggleRouteStop(lead)}
                                          className="size-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400 shrink-0"
                                        />
                                        {/* Aerial scan condition dot */}
                                        {scan && (
                                          <span
                                            className={`size-2.5 rounded-full shrink-0 ${scan.condition === 'poor' ? 'bg-red-500' : scan.condition === 'fair' ? 'bg-amber-500' : scan.condition === 'good' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                            title={`Roof condition: ${scan.condition} (${scan.score}/10)`}
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-slate-800 truncate">{lead.street}</div>
                                          <div className="text-xs text-slate-500 truncate">
                                            {lead.name || 'Unknown'} · {stageLabel(lead.stage)}
                                            {scan && <span className={`ml-1 font-semibold ${scan.condition === 'poor' ? 'text-red-600' : scan.condition === 'fair' ? 'text-amber-600' : scan.condition === 'good' ? 'text-emerald-600' : 'text-slate-400'}`}>· {scan.condition} ({scan.score}/10)</span>}
                                          </div>
                                        </div>
                                        {!isGeocoded && <Loader2 className="size-3 text-amber-500 animate-spin shrink-0" />}
                                      </label>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {selectedRoad && activeRoad && (
              <motion.div key="addresses" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <Card className="border-slate-200">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-slate-800"><MapPin className="size-4 text-blue-500" /> {activeRoad.name}</CardTitle><CardDescription>{activeRoad.leads.length} address{activeRoad.leads.length === 1 ? '' : 's'}.</CardDescription></CardHeader>
                  <CardContent className="pt-0 space-y-1.5">
                    {activeRoad.leads.map(lead => {
                      const inRoute = routeStops.some(s => s.leadId === lead.id)
                      const isGeocoded = geocodedLeads.has(lead.id)
                      return (
                        <div key={lead.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${inRoute ? 'border-[#0084ff]/40 bg-[#0084ff]/5' : 'border-[#e5edf5] bg-white hover:border-[#c3d6ea]'}`}>
                          <button type="button" onClick={() => toggleRouteStop(lead)} disabled={!isGeocoded} className={`size-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${inRoute ? 'bg-[#0084ff] text-white' : isGeocoded ? 'bg-slate-100 text-slate-400 hover:bg-[#0084ff]/10 hover:text-blue-500' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`} aria-label={inRoute ? 'Remove from route' : 'Add to route'} title={!isGeocoded ? 'Geocoding…' : undefined}>
                            {inRoute ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                          </button>
                          <button type="button" onClick={() => setSelectedLeadForMap(lead.id === selectedLeadForMap ? null : lead.id)} className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-semibold text-slate-800 truncate">{lead.street}</div>
                            <div className="text-xs text-slate-500 truncate">{lead.name || 'Unknown'} · {stageLabel(lead.stage)}</div>
                          </button>
                          {onOpenLead && <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => onOpenLead(lead.id)} aria-label={`Open ${lead.street}`}><Eye className="size-3.5 text-slate-400" /></Button>}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {routeStops.length > 0 && (
            <Card className="border-[#0084ff]/30 bg-gradient-to-br from-[#f0f7ff] to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                  <Route className="size-4 text-blue-500" /> Canvass Route
                  {activeRouteId && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>}
                </CardTitle>
                <CardDescription>Reorder with arrows. Mark stops as visited as you canvass.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {routeStops.map((stop, i) => {
                  const stopStatus = stopStatuses[stop.leadId] || 'pending'
                  return (
                    <div key={stop.leadId} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                      stopStatus === 'visited' ? 'border-emerald-200 bg-emerald-50/50' :
                      stopStatus === 'skipped' ? 'border-slate-200 bg-slate-50 opacity-60' :
                      'border-[#0084ff]/15 bg-white'
                    }`}>
                      <div className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        stopStatus === 'visited' ? 'bg-emerald-500 text-white' :
                        stopStatus === 'skipped' ? 'bg-slate-300 text-slate-500' :
                        'bg-[#0084ff] text-white'
                      }`}>
                        {stopStatus === 'visited' ? <Check className="size-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${stopStatus === 'visited' ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>{stop.street}</div>
                        <div className="text-xs text-slate-500 truncate">{stop.name}</div>
                      </div>
                      {/* Stop status actions (only when a saved route is active) */}
                      {activeRouteId && stopStatus === 'pending' && (
                        <div className="flex gap-0.5 shrink-0">
                          <button type="button" onClick={() => markStopVisited(stop.leadId, 'visited')} className="size-6 rounded flex items-center justify-center text-emerald-500 hover:bg-emerald-50" aria-label="Mark visited" title="Mark as visited"><CheckCircle2 className="size-4" /></button>
                          <button type="button" onClick={() => markStopVisited(stop.leadId, 'skipped')} className="size-6 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Skip" title="Skip this stop"><SkipForward className="size-3.5" /></button>
                        </div>
                      )}
                      {!activeRouteId && (
                        <>
                          <div className="flex flex-col gap-0.5">
                            <button type="button" onClick={() => moveStop(i, 'up')} disabled={i === 0} className="size-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-500 disabled:opacity-30" aria-label="Move up"><ChevronDown className="size-3 rotate-180" /></button>
                            <button type="button" onClick={() => moveStop(i, 'down')} disabled={i === routeStops.length - 1} className="size-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-500 disabled:opacity-30" aria-label="Move down"><ChevronDown className="size-3" /></button>
                          </div>
                          <button type="button" onClick={() => toggleRouteStop({ id: stop.leadId, street: stop.street, name: stop.name } as Lead)} className="size-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 shrink-0" aria-label="Remove stop"><X className="size-3.5" /></button>
                        </>
                      )}
                    </div>
                  )
                })}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {/* Save route (only when not already saved) */}
                  {!activeRouteId && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setSaveDialogOpen(true)} className="border-[#0084ff]/30 text-blue-500 hover:bg-[#0084ff]/5">
                      <Save className="size-3.5" /> Save Route
                    </Button>
                  )}
                  {/* Complete route (only when a saved route is active) */}
                  {activeRouteId && (
                    <Button type="button" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => completeRouteMut.mutate(activeRouteId)} disabled={completeRouteMut.isPending}>
                      <CheckCircle2 className="size-3.5" /> {completeRouteMut.isPending ? 'Completing…' : 'Complete Route'}
                    </Button>
                  )}
                  {/* Turn-by-turn directions */}
                  {routeStops.length >= 2 && (
                    <a href={`https://www.google.com/maps/dir/${routeStops.map(s => `${s.lat},${s.lng}`).join('/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0084ff] text-white text-xs font-semibold hover:bg-[#0070e0] transition-colors">
                      <ExternalLink className="size-3.5" /> Directions
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Routes panel */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                <FolderOpen className="size-4 text-slate-500" /> Saved Routes
              </CardTitle>
              <CardDescription>Load, continue, or review past canvass routes.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {savedRoutesQ.isLoading ? (
                <p className="text-sm text-slate-400 text-center py-3">Loading saved routes…</p>
              ) : (savedRoutesQ.data?.routes || []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-3">No saved routes yet. Build a route above and click Save.</p>
              ) : (
                (savedRoutesQ.data?.routes || []).map(route => {
                  const visited = route.stops.filter(s => s.status === 'visited').length
                  const total = route.stops.length
                  const pct = total > 0 ? Math.round((visited / total) * 100) : 0
                  return (
                    <div key={route.id} className="rounded-lg border border-slate-200 bg-white p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`size-2.5 rounded-full shrink-0 ${route.status === 'completed' ? 'bg-emerald-500' : route.status === 'active' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                          <span className="text-sm font-semibold text-slate-800 truncate">{route.name}</span>
                          {route.town && <span className="text-xs text-slate-400 shrink-0">· {route.town}</span>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-500" onClick={() => loadRoute(route)} disabled={route.status === 'completed'}>
                            <FolderOpen className="size-3.5" /> Load
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => setDeleteRouteId(route.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{total} stops</span>
                        <span>·</span>
                        <span className={route.status === 'completed' ? 'text-emerald-600 font-semibold' : ''}>
                          {route.status === 'completed' ? 'Completed' : `${visited}/${total} visited (${pct}%)`}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5"><Clock className="size-3" />{new Date(route.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {/* Progress bar */}
                      {route.status !== 'completed' && total > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Save Route Dialog */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Save className="size-5 text-blue-500" /> Save Canvass Route</DialogTitle>
                <DialogDescription>Save this route with {routeStops.length} stop{routeStops.length === 1 ? '' : 's'} for later use.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="route-name">Route name</Label>
                  <Input id="route-name" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="e.g. Mount Vernon North — Tuesday canvass" />
                </div>
                {activeTown && <div className="text-xs text-slate-500">Town: {activeTown.name}</div>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSaveRoute} disabled={saveRouteMut.isPending}>
                  {saveRouteMut.isPending ? 'Saving…' : 'Save Route'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete route confirm */}
          <AlertDialog open={!!deleteRouteId} onOpenChange={o => !o && setDeleteRouteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this route?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete the route and all its stops. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteRouteId && deleteRouteMut.mutate(deleteRouteId)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Right: live road/satellite map with segmentation + pins */}
        <div className="lg:col-span-3">
          <Card
            className="overflow-hidden shadow-lg transition-colors"
            style={{
              borderColor: selectedTown ? segmentColor : '#d6e2ee',
              borderWidth: selectedTown ? 2 : 1,
            }}
          >
            <div className="relative aspect-[4/3] sm:aspect-[16/11] bg-[#1a2a3a]">
              <LeafletMap bounds={mapBounds} mode={mapMode} />

              {/* Address verification status */}
              {unverifiedLeads.length > 0 && (
                <div className="absolute top-3 left-3 right-3 z-[500]">
                  <div className="rounded-lg border border-amber-200 bg-amber-50/95 backdrop-blur-md px-3 py-2.5 shadow-lg text-xs text-amber-900">
                    <div className="font-semibold">{unverifiedLeads.length} address{unverifiedLeads.length === 1 ? '' : 'es'} need verification.</div>
                    <div className="mt-0.5">Unverified addresses are intentionally not pinned or routed.</div>
                  </div>
                </div>
              )}
              {/* Segmentation border overlay — colored frame matching the selected quadrant */}
              {selectedTown && (
                <div
                  className="absolute inset-0 pointer-events-none z-[400]"
                  style={{
                    boxShadow: `inset 0 0 0 3px ${segmentColor}, inset 0 0 20px ${segmentColor}33`,
                    borderRadius: 'inherit',
                  }}
                />
              )}

              {/* Route connecting line (SVG overlay) */}
              {routePinPositions.length >= 2 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[410]" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <polyline
                    points={routePinPositions.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#0084ff"
                    strokeWidth="0.8"
                    strokeDasharray="1.5,0.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </svg>
              )}

              {/* Pin overlays — positioned by lat/lng percentage within bounds */}
              <div className="absolute inset-0 z-[420]">
                {visiblePins.map(({ lead, pos }) => {
                  const q = getQuadrant(lead, geocodedLeads.get(lead.id), activeTown ? townCenters.get(activeTown.name) : null)
                  const scan = aerialScans.get(lead.id)
                  // Pin color: scan condition takes priority over quadrant color
                  const pinColor = scan ? (scan.condition === 'poor' ? '#ef4444' : scan.condition === 'fair' ? '#f59e0b' : scan.condition === 'good' ? '#10b981' : QUADRANT_COLORS[q]) : QUADRANT_COLORS[q]
                  const inRoute = routeStops.some(s => s.leadId === lead.id)
                  const routeOrder = routeStops.findIndex(s => s.leadId === lead.id)
                  const isSelected = selectedLeadForMap === lead.id
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelectedLeadForMap(lead.id === selectedLeadForMap ? null : lead.id)}
                      className="absolute -translate-x-1/2 -translate-y-full group"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      title={`${lead.street} — ${lead.name || 'Unknown'}${scan ? ` · ${scan.condition.toUpperCase()} (${scan.score}/10)` : ''}`}
                    >
                      {/* Pin teardrop */}
                      <div
                        className={`rounded-full rounded-bl-none rotate-45 border-2 border-white shadow-lg transition-all ${
                          isSelected ? 'scale-125 z-10' : 'group-hover:scale-110'
                        }`}
                        style={{
                          width: isSelected ? 26 : 22,
                          height: isSelected ? 26 : 22,
                          backgroundColor: pinColor,
                          boxShadow: isSelected ? `0 0 12px ${pinColor}` : '0 2px 6px rgba(0,0,0,0.35)',
                        }}
                      />
                      {/* Route order badge */}
                      {inRoute && (
                        <span
                          className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-[#0084ff] border-2 border-white text-white text-xs font-bold flex items-center justify-center shadow-md"
                        >
                          {routeOrder + 1}
                        </span>
                      )}
                      {/* Selected pulse ring */}
                      {isSelected && (
                        <span
                          className="absolute top-1 left-1/2 -translate-x-1/2 size-7 rounded-full border-2 animate-ping"
                          style={{ borderColor: pinColor }}
                        />
                      )}
                      {/* Hover tooltip */}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#071321] text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                        {lead.street}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Segmentation label + breadcrumb overlay (top-left) */}
              <div className="absolute top-3 left-3 z-[500] pointer-events-none">
                <div className="px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-md flex items-center gap-1.5 shadow-lg text-slate-800">
                  {activeTown && <Building2 className="size-3.5" />}
                  {activeTown && <span className="text-xs font-bold">{activeTown.name}</span>}
                  {activeQuadrant && <ChevronRight className="size-3 opacity-50" />}
                  {activeQuadrant && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: segmentColor + '20', color: segmentColor }}>
                      {activeQuadrant.label}
                    </span>
                  )}
                  {selectedRoad && <ChevronRight className="size-3 opacity-50" />}
                  {selectedRoad && <span className="text-xs text-slate-500">{selectedRoad}</span>}
                  {!activeTown && <MapPin className="size-3.5 text-blue-500" />}
                  {!activeTown && <span className="text-xs font-bold">All Towns ({mapLeads.length} leads)</span>}
                </div>
              </div>

              {/* Open the selected address in a full map */}
              <a
                href={selectedLeadForMap && geocodedLeads.get(selectedLeadForMap) ? `https://www.google.com/maps/@?api=1&map_action=map&center=${geocodedLeads.get(selectedLeadForMap)!.lat},${geocodedLeads.get(selectedLeadForMap)!.lng}&zoom=18` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!selectedLeadForMap || !geocodedLeads.has(selectedLeadForMap)}
                onClick={(e) => { if (!selectedLeadForMap || !geocodedLeads.has(selectedLeadForMap)) e.preventDefault() }}
                className="absolute top-3 right-3 z-[500] px-2.5 py-1.5 rounded-lg bg-white/90 backdrop-blur-md shadow-lg text-blue-500 text-xs font-semibold hover:bg-white transition-colors flex items-center gap-1"
              >
                <ExternalLink className="size-3" /> Full Map
              </a>

              {/* Selected lead info popup */}
              <AnimatePresence>
                {selectedLeadForMap && (() => {
                  const lead = leads.find(l => l.id === selectedLeadForMap)
                  if (!lead) return null
                  const inRoute = routeStops.some(s => s.leadId === lead.id)
                  const isGeocoded = geocodedLeads.has(lead.id) && lead.geocodeStatus === 'verified'
                  const geo = geocodedLeads.get(lead.id)
                  const scan = aerialScans.get(lead.id)
                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.15 }} className="absolute bottom-3 left-3 right-3 z-[500] sm:right-auto sm:min-w-[300px]">
                      <div className="px-3 py-2.5 rounded-lg shadow-xl bg-white text-slate-800 border border-slate-200">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-sm font-bold truncate">{lead.street}</div>
                          <button type="button" onClick={() => setSelectedLeadForMap(null)} className="shrink-0 text-slate-400 hover:text-slate-600"><X className="size-3.5" /></button>
                        </div>
                        <div className="text-xs text-slate-500">{lead.name || 'Unknown'} · {stageLabel(lead.stage)}</div>
                        {/* Aerial scan result */}
                        {scan && (
                          <div className={`mt-2 p-2 rounded-md border text-xs ${scan.condition === 'poor' ? 'bg-red-50 border-red-200 text-red-700' : scan.condition === 'fair' ? 'bg-amber-50 border-amber-200 text-amber-700' : scan.condition === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                            <div className="flex items-center gap-1.5 font-bold">
                              <span className={`size-2.5 rounded-full ${scan.condition === 'poor' ? 'bg-red-500' : scan.condition === 'fair' ? 'bg-amber-500' : scan.condition === 'good' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {scan.condition === 'poor' ? 'Poor Condition' : scan.condition === 'fair' ? 'Fair Condition' : scan.condition === 'good' ? 'Good Condition' : 'Unknown'} · Score {scan.score}/10
                            </div>
                            {scan.findings && <div className="mt-0.5 text-slate-600">{scan.findings}</div>}
                            {scan.indicators && scan.indicators.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {scan.indicators.slice(0, 4).map((ind, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-white/60 text-[10px] font-medium">{ind}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {!scan && isGeocoded && (
                          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                            <Satellite className="size-3" /> Not yet scanned — click "Scan Roofs" to analyze
                          </div>
                        )}
                        {geo && <div className="text-xs text-slate-400 mt-0.5">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</div>}
                        {!isGeocoded && <div className="text-xs text-amber-700 mt-1 flex items-center gap-1"><MapPin className="size-3" /> Address is not verified — no property pin is used.</div>}
                        <div className="flex items-center gap-1.5 mt-2">
                          {!isGeocoded && <button type="button" onClick={() => verifyAddress(lead)} disabled={verifyingAddressId === lead.id} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50">{verifyingAddressId === lead.id ? 'Verifying…' : 'Verify address'}</button>}
                          <button type="button" onClick={() => toggleRouteStop(lead)} disabled={!isGeocoded} className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${inRoute ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#0084ff] text-white hover:bg-[#0070e0]'}`}>
                            {inRoute ? '− Remove' : '+ Add to route'}
                          </button>
                          {onOpenLead && <button type="button" onClick={() => onOpenLead(lead.id)} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 hover:bg-slate-200"><Eye className="size-3 inline mr-0.5" />Open</button>}
                          {geo && <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${geo.lat},${geo.lng}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><ExternalLink className="size-3 inline mr-0.5" />Street View</a>}
                        </div>
                      </div>
                    </motion.div>
                  )
                })()}
              </AnimatePresence>
            </div>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3 mt-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center"><div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Visible</div><div className="text-lg font-bold text-slate-800">{mapLeads.length}</div><div className="text-xs text-slate-400">leads</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center"><div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Route</div><div className="text-lg font-bold text-blue-500">{routeStops.length}</div><div className="text-xs text-slate-400">stops</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center"><div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Scanned</div><div className="text-lg font-bold text-violet-600">{aerialScans.size}</div><div className="text-xs text-slate-400">roofs analyzed</div></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Poor Roofs</div>
              <div className="text-lg font-bold text-red-500">{Array.from(aerialScans.values()).filter(s => s.condition === 'poor').length}</div>
              <div className="text-xs text-slate-400">priority targets</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
