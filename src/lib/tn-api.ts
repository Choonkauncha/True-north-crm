// True North Field OS — Client-side API helpers + shared types.
// All paths are relative (e.g. "/api/leads") so they go through the gateway.


export type UserRole = 'admin' | 'sales' | 'setter'

export interface AuthSession {
  role: UserRole
  employeeId: string
  employeeName: string
  exp: number
}

export interface Appointment {
  id: string
  leadId: string
  address: string
  status: 'yes' | 'no' | 'completed' | 'cancelled'
  appointmentDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CrmRecord extends Lead {
  latestAppointment: Appointment | null
}

export interface PhotoAsset {
  id: string
  leadId: string | null
  address: string
  title: string
  category: string
  dataUrl: string
  createdAt: string
}

export interface EmployeeProfile {
  id: string
  name: string
  role: UserRole
  email: string
  phone: string
  notes: string
  active: boolean
  lastLoginAt: string | null
  createdAt: string
  metrics: { leads: number; estimates: number; appointments: number; jobs: number }
}

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  street: string
  city: string
  state: string
  zip: string
  latitude: number | null
  longitude: number | null
  formattedAddress: string | null
  geocodeStatus: 'unverified' | 'verified' | 'needs_review'
  geocodeProvider: string | null
  geocodeAccuracy: number | null
  geocodeAccuracyType: string | null
  stableAddressKey: string | null
  geocodedAt: string | null
  source: string
  territory: string
  notes: string
  stage: LeadStage
  nextAction: string
  verifiedArea: number | null
  pitch: number | null
  contractFile: string | null
  createdAt: string
  updatedAt: string
}

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'inspection_set'
  | 'inspection_complete'
  | 'estimate_sent'
  | 'follow_up'
  | 'contracted'
  | 'job_open'
  | 'job_complete'
  | 'lost'
  | 'future'
  | 'do_not_contact'

export interface Estimate {
  id: string
  leadId: string | null
  property: string
  product: string
  productId: string
  color: string
  area: number
  squares: number
  wastePct: number
  discount: number
  shinglePerSq: number
  profileName: string
  price: number
  directCost: number
  grossProfit: number
  grossMarginPct: number
  status: 'sent' | 'accepted' | 'rejected' | 'expired'
  createdAt: string
  updatedAt: string
}

export interface Job {
  id: string
  estimateId: string | null
  leadId: string | null
  property: string
  contractValue: number
  actualCost: number
  cashCollected: number
  balance: number
  contractFilename: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  startDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PricingProfile {
  id: string
  name: string
  materialPerSq: number
  laborPerSq: number
  tearOffPerSq: number
  underlaymentPerSq: number
  accessoriesPerSq: number
  disposalPerJob: number
  permitPerJob: number
  salesCommissionPct: number
  targetGrossMarginPct: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierPrice {
  id: string
  product: string
  color: string
  price: number
  supplier: string
  item: string
  savedAt: string
}

export interface InspectionReport {
  id: string
  leadId: string | null
  photoDataUrl: string
  windCount: number
  hailCount: number
  missingCount: number
  totalCount: number
  recommendedIko: string
  summary: string
  source: string
  createdAt: string
}

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface IkoProduct {
  id: string
  name: string
  shortName: string
  warranty: string
  exposure: string
  classRating: string
  windRating: string
  colors: string[]
  description: string
}

export interface CatalogResponse {
  catalog: IkoProduct[]
  profiles: PricingProfile[]
}

export interface ActivityItem {
  type: 'lead_created' | 'lead_stage' | 'estimate_created' | 'estimate_accepted' | 'job_created' | 'job_completed' | 'inspection'
  label: string
  detail: string
  timestamp: string
  refId: string
}

export interface RevenueTrendPoint {
  month: string
  revenue: number
  cost: number
  margin: number
  jobCount: number
}

export interface StaleLead {
  id: string
  street: string
  name: string
  stage: string
  nextAction: string
  daysInStage: number
  updatedAt: string
}

export interface TerritoryStat {
  territory: string
  leads: number
  contracted: number
  revenue: number
  jobs: number
}

export interface MetricsResponse {
  totalLeads: number
  contractedLeads: number
  pendingEstimates: number
  activeJobs: number
  totalRevenue: number
  totalCashCollected: number
  avgMarginPct: number
  stageCounts: Record<string, number>
  recentActivity: ActivityItem[]
  revenueTrend: RevenueTrendPoint[]
  kpiTrends: {
    leads: number[]
    contracted: number[]
    pending: number[]
    revenue: number[]
  }
  staleLeads: StaleLead[]
  territoryStats: TerritoryStat[]
}

export interface MeasureResponse {
  pitchFactor: number
  finalArea: number
  squares: number
}

export interface EstimateCalcResponse {
  shinglePerSq: number
  squares: number
  materialCost: number
  laborCost: number
  tearOffCost: number
  underlayCost: number
  accessCost: number
  fixedCost: number
  totalDirectCost: number
  marginRatio: number
  rawPrice: number
  finalPrice: number
  grossProfit: number
  actualMarginPct: number
  supplierPrice: SupplierPrice | null
}

export interface RoofDetection {
  windCount: number
  hailCount: number
  missingCount: number
  totalCount: number
  recommendedIko: string
  detections: Array<{
    class: string
    confidence: number
    modelType: 'wind' | 'hail' | 'missing'
    note: string
  }>
  summary: string
}

export interface InspectionResponse {
  report: InspectionReport
  detection: RoofDetection
}

export interface EstimateDetailLead {
  id: string
  name: string
  phone: string
  email: string
  street: string
  city: string
  state: string
  zip: string
  source: string
  territory: string
  verifiedArea: number | null
  pitch: number | null
}

export interface EstimateDetailJob {
  id: string
  status: string
  contractValue: number
  contractFilename: string | null
}

export interface EstimateDetailProduct {
  id: string
  name: string
  shortName: string
  warranty: string
  exposure: string
  classRating: string
  windRating: string
  description: string
}

export interface EstimateDetailResponse {
  estimate: Estimate & {
    wastePct: number
    discount: number
    shinglePerSq: number
    profileName: string
  }
  lead: EstimateDetailLead | null
  job: EstimateDetailJob | null
  product: EstimateDetailProduct | null
}

export interface BackupPayload {
  version?: number
  exportedAt?: string
  employees?: EmployeeProfile[]
  leads?: Lead[]
  appointments?: Appointment[]
  photos?: PhotoAsset[]
  estimates?: Estimate[]
  jobs?: Job[]
  profiles?: PricingProfile[]
  prices?: SupplierPrice[]
  inspections?: InspectionReport[]
  copilotMessages?: CopilotMessage[]
  activityLogs?: Array<{ id: string; employeeId: string; action: string; entityType: string; entityId: string | null; summary: string; createdAt: string }>
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let json: any = null
  try {
    json = await res.json()
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg = (json && (json.error || json.message)) || `${res.status} ${res.statusText}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return json as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body)
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}

// Formatting helpers
export function fmtMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function fmtMoneyDetail(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Stage badge styling helper — returns tailwind classes for a given lead stage.
export function stageBadgeClasses(stage: LeadStage | string): string {
  switch (stage) {
    case 'new':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'contacted':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'inspection_set':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'inspection_complete':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'estimate_sent':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'follow_up':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'contracted':
    case 'job_open':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'job_complete':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'lost':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'do_not_contact':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    case 'future':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export function stageLabel(stage: LeadStage | string): string {
  const map: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    inspection_set: 'Inspection Set',
    inspection_complete: 'Inspection Complete',
    estimate_sent: 'Estimate Sent',
    follow_up: 'Follow Up',
    contracted: 'Contracted',
    job_open: 'Job Open',
    job_complete: 'Job Complete',
    lost: 'Lost',
    future: 'Future',
    do_not_contact: 'Do Not Contact'
  }
  return map[stage] || String(stage)
}

export const LEAD_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'inspection_set',
  'inspection_complete',
  'estimate_sent',
  'follow_up',
  'contracted',
  'job_open',
  'job_complete',
  'lost',
  'future',
  'do_not_contact'
]

// ─── Canvass Route types ─────────────────────────────────────────────────────────

export interface CanvassStop {
  id: string
  routeId: string
  leadId: string | null
  street: string
  name: string
  lat: number
  lng: number
  order: number
  status: 'pending' | 'visited' | 'skipped'
  notes: string
  visitedAt: string | null
  createdAt: string
}

export interface CanvassRoute {
  id: string
  name: string
  town: string
  status: 'draft' | 'active' | 'completed'
  notes: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
  stops: CanvassStop[]
}

// ─── Aerial Scan types ───────────────────────────────────────────────────────────

export interface AerialScan {
  id: string
  leadId: string | null
  lat: number
  lng: number
  address: string
  conditionScore: number  // 0=unknown, 1-10
  condition: 'unknown' | 'good' | 'fair' | 'poor'
  findings: string
  indicators: string  // JSON array
  imageDataUrl: string
  scannedAt: string
}
