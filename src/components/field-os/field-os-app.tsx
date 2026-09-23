'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Ruler,
  FileText,
  Hammer,
  Package,
  DollarSign,
  MessageSquare,
  HelpCircle,
  Compass,
  ArrowRight,
  Map,
  Camera,
  UserCog,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CopilotDrawer } from '@/components/field-os/copilot-drawer'
import { TutorialOverlay, type TutorialStep } from '@/components/field-os/tutorial-overlay'
import { BackupRestore } from '@/components/field-os/backup-restore'
import { DashboardView } from '@/components/field-os/views/dashboard-view'
import { LeadsView } from '@/components/field-os/views/leads-view'
import { MeasureView, type MeasurePrefill } from '@/components/field-os/views/measure-view'
import { EstimatesView } from '@/components/field-os/views/estimates-view'
import { JobsView } from '@/components/field-os/views/jobs-view'
import { MaterialsView } from '@/components/field-os/views/materials-view'
import { PricingView } from '@/components/field-os/views/pricing-view'
import { RouteMapView } from '@/components/field-os/views/route-map-view'
import { CrmView } from '@/components/field-os/views/crm-view'
import { PhotoBankView } from '@/components/field-os/views/photo-bank-view'
import { EmployeesView } from '@/components/field-os/views/employees-view'
import type { AuthSession, UserRole } from '@/lib/tn-api'

export type ViewId =
  | 'dashboard'
  | 'leads'
  | 'measure'
  | 'estimates'
  | 'jobs'
  | 'materials'
  | 'pricing'
  | 'route-map'
  | 'crm'
  | 'photo-bank'
  | 'employees'

interface ViewMeta {
  id: ViewId
  label: string
  shortLabel: string
  subtitle: string
  icon: typeof LayoutDashboard
}

const VIEWS: ViewMeta[] = [
  { id: 'dashboard', label: 'Command Center', shortLabel: 'Home', subtitle: 'Operating loop pipeline, KPIs, and today\'s contract queue.', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads & Pipeline', shortLabel: 'Leads', subtitle: 'Capture every door-knock and inspection. Move leads through the operating loop.', icon: Users },
  { id: 'route-map', label: 'Route Map', shortLabel: 'Map', subtitle: 'Satellite territory map with door-to-door canvass route creation.', icon: Map },
  { id: 'measure', label: 'Measure + Estimate', shortLabel: 'Measure', subtitle: 'Field measurement, AI roof damage inspection, and IKO proposal builder.', icon: Ruler },
  { id: 'estimates', label: 'Estimates', shortLabel: 'Estimates', subtitle: 'Track every IKO proposal. Accept an estimate to attach a signed contract.', icon: FileText },
  { id: 'jobs', label: 'Jobs & Contracts', shortLabel: 'Jobs', subtitle: 'Signed contracts become jobs. Track actual cost, cash collected, and margin.', icon: Hammer },
  { id: 'materials', label: 'IKO Materials', shortLabel: 'Materials', subtitle: 'Official IKO shingle catalog and verified distributor pricing.', icon: Package },
  { id: 'pricing', label: 'Pricing Profiles', shortLabel: 'Pricing', subtitle: 'Real-cost pricing profiles: material, labor, tear-off, fixed costs, and target margin.', icon: DollarSign },
  { id: 'crm', label: 'CRM', shortLabel: 'CRM', subtitle: 'Address-first customer records, appointment status, and call notes.', icon: Users },
  { id: 'photo-bank', label: 'Photo Bank', shortLabel: 'Photos', subtitle: 'Property photos and AI inspection images organized by address.', icon: Camera },
  { id: 'employees', label: 'Employees & Access', shortLabel: 'Team', subtitle: 'Authenticated employee profiles, track record, and access gates.', icon: UserCog },
]

const ROLE_VIEWS: Record<UserRole, ViewId[]> = {
  admin: VIEWS.map(v => v.id),
  sales: ['leads', 'crm', 'route-map', 'photo-bank', 'measure'],
  setter: ['route-map', 'crm'],
}

const PIPELINE_STEPS = [
  'Lead',
  'Inspection',
  'Verified Area',
  'IKO Proposal',
  'Signed Contract',
  'Job Cash Flow',
]

const TUTORIALS: Record<ViewId, TutorialStep[]> = {
  dashboard: [
    { selector: '[data-tut="pipeline"]', title: 'The Operating Loop', text: 'Every job moves through these six stages — from a door-knocked lead all the way to cash in the bank.' },
    { selector: '[data-tut="kpis"]', title: 'KPIs at a Glance', text: 'Total leads, contracted jobs, pending proposals, and contracted revenue keep you oriented.' },
    { selector: '[data-tut="queue"]', title: 'Today\'s Contract Queue', text: 'The next 6 active leads, ranked by what action is owed. Click Manage to advance the loop.' },
    { selector: '[data-tut="rules"]', title: 'True North Operating Rules', text: 'Five non-negotiable rules. No estimate goes out without a field-verified area. No job without a signed contract.' },
    { selector: '[data-tut="quickactions"]', title: 'Quick Actions', text: 'Jump straight to creating a lead or measuring a roof from here.' },
  ],
  leads: [
    { selector: '[data-tut="toolbar"]', title: 'Capture Every Lead', text: 'New Lead opens the intake form. Import CSV bulk-loads a door-knock list. Filter by stage to focus the queue.' },
    { selector: '[data-tut="table"]', title: 'Pipeline at a Glance', text: 'Every lead, its stage badge, and the next action owed. Click Manage to inspect, advance, or send to measurement.' },
  ],
  measure: [
    { selector: '[data-tut="measure-panel"]', title: '1. Field Measurement', text: 'Enter footprint area + pitch. We compute pitch factor, verified roof area, and squares — and save it back to the lead.' },
    { selector: '[data-tut="inspect-panel"]', title: '2. AI Roof Damage Inspection', text: 'Upload a slope photo (or load the sample). The VLM counts wind creases, hail impacts, and missing shingles — and flags insurance claim eligibility.' },
    { selector: '[data-tut="proposal-panel"]', title: '3. Build IKO Proposal', text: 'Verified area + waste + IKO product + pricing profile = a real-cost proposal with target margin. Save it as an estimate.' },
  ],
  estimates: [
    { selector: '[data-tut="table"]', title: 'Every Proposal Tracked', text: 'See price, margin, and status for every IKO estimate you generate.' },
    { selector: '[data-tut="actions"]', title: 'Accept → Attach Contract', text: 'Mark an estimate accepted, then attach the signed contract PDF to spawn a Job.' },
  ],
  jobs: [
    { selector: '[data-tut="table"]', title: 'Jobs Are Signed Contracts', text: 'Each row is real money: contract value, cash collected, open balance, and actual margin.' },
    { selector: '[data-tut="actions"]', title: 'Track Job Economics', text: 'Update actual costs and cash collected as the job progresses. Status moves scheduled → in_progress → completed.' },
  ],
  materials: [
    { selector: '[data-tut="catalog"]', title: 'Official IKO Catalog', text: 'Dynasty, Cambridge, Nordic — warranty, exposure, class & wind ratings, and available colors.' },
    { selector: '[data-tut="prices"]', title: 'Verified Supplier Pricing', text: 'Save real $/square quotes from ABC Supply. These prices flow directly into your estimate calculations.' },
  ],
  pricing: [
    { selector: '[data-tut="profiles"]', title: 'Real-Cost Pricing Profiles', text: 'Material/sq, labor/sq, tear-off/sq, underlayment/sq, accessories/sq, fixed costs, and target margin.' },
    { selector: '[data-tut="form"]', title: 'Build a New Profile', text: 'Create a profile for each shingle line and margin target you quote.' },
  ],
  crm: [
    { selector: '[data-tut="crm"]', title: 'Address CRM', text: 'Each property has an appointment yes/no record and notes that stay with the address.' },
  ],
  'photo-bank': [
    { selector: '[data-tut="photo-bank"]', title: 'Property Photo Bank', text: 'Upload a compressed property photo and attach it directly to the customer address. AI inspection photos appear here automatically.' },
  ],
  employees: [
    { selector: '[data-tut="employees"]', title: 'Employee Track Record', text: 'Authenticated employees are tied to activity counts so a growing roofing team can see who is creating leads, appointments, estimates, and jobs.' },
  ],
  'route-map': [
    { selector: '[data-tut="toolbar"]', title: 'Territory Navigation', text: 'Drill down from Town → Quadrant (N/S/E/W) → Road → Addresses to find leads in your canvass area.' },
    { selector: '[data-tut="table"]', title: 'Interactive Map', text: 'Toggle satellite/road mode. Click pins to see lead details and add them to your canvass route.' },
  ],
}

export function FieldOSApp({ initialSession }: { initialSession: AuthSession }) {
  const [activeView, setActiveView] = useState<ViewId>(() => {
    const first = ROLE_VIEWS[initialSession.role][0]
    return first || 'dashboard'
  })
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [measurePrefill, setMeasurePrefill] = useState<MeasurePrefill | null>(null)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  const availableViews = useMemo(() => VIEWS.filter(v => ROLE_VIEWS[initialSession.role].includes(v.id)), [initialSession.role])
  const meta = useMemo(() => VIEWS.find(v => v.id === activeView)!, [activeView])

  // Auto-run each view's tutorial once per browser.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const seenKey = `tn_tut_seen_${activeView}`
    const seen = window.localStorage.getItem(seenKey)
    if (!seen) {
      const t = window.setTimeout(() => {
        setTutorialOpen(true)
        window.localStorage.setItem(seenKey, '1')
      }, 600)
      return () => window.clearTimeout(t)
    }
  }, [activeView])

  const handleOpenTutorial = useCallback(() => {
    setTutorialOpen(true)
  }, [])

  const handleNavigate = useCallback((view: ViewId) => {
    if (ROLE_VIEWS[initialSession.role].includes(view)) setActiveView(view)
  }, [initialSession.role])

  const goToMeasureForLead = useCallback((prefill: MeasurePrefill) => {
    setMeasurePrefill(prefill)
    setActiveView('measure')
  }, [])

  // Navigate to the leads view and open a specific lead's detail dialog.
  // Used by the dashboard's stale-leads callout for click-through.
  const openLeadDetail = useCallback((leadId: string) => {
    setOpenLeadId(leadId)
    setActiveView(initialSession.role === 'setter' ? 'crm' : 'leads')
  }, [initialSession.role])

  const tutorialSteps = TUTORIALS[activeView] || []

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fc]">
      {/* Sidebar (desktop) */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[270px] flex-col bg-gradient-to-b from-[#071321] to-[#050d18] border-r border-[#183354] z-30"
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#183354]">
          <img
            src="/true-north-logo.png"
            alt="True North Restorations logo"
            className="w-11 h-11 rounded-lg ring-1 ring-[#40d4ff]/30 bg-[#0c1a2c]"
          />
          <div className="min-w-0">
            <div className="text-white font-bold text-base leading-tight tracking-tight">True North</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#40d4ff]">Field OS</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Views">
          <ul className="space-y-1">
            {availableViews.map(v => {
              const Icon = v.icon
              const active = v.id === activeView
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => handleNavigate(v.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#0084ff] text-white shadow-lg shadow-[#0084ff]/20'
                        : 'text-[#e2ebf5]/80 hover:bg-[#0c1a2c] hover:text-white'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{v.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-[#183354]">
          <div className="rounded-lg bg-[#0c1a2c] border border-[#183354] p-3">
            <div className="flex items-center gap-2 text-[#40d4ff] text-[10px] uppercase tracking-[0.16em] font-semibold mb-2">
              <Compass className="size-3.5" aria-hidden="true" />
              Operating Loop
            </div>
            <ol className="text-[11px] text-[#e2ebf5]/80 space-y-0.5">
              {PIPELINE_STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full bg-[#102238] border border-[#183354] text-[9px] flex items-center justify-center text-[#40d4ff] font-bold">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header
        className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#d6e2ee] lg:ml-[270px]"
      >
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-[#071321] tracking-tight leading-tight truncate">
              {meta.label}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 truncate">{meta.subtitle}</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {initialSession.role === 'admin' && <BackupRestore />}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenTutorial}
              className="hidden sm:inline-flex"
              aria-label="Open tutorial for this view"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">How Do I Do This?</span>
            </Button>

            <Badge
              variant="outline"
              className="hidden sm:inline-flex gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-1 font-medium"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {initialSession.role === 'setter' ? 'Cloud' : 'Cloud + AI'}
            </Badge>

            {initialSession.role !== 'setter' && <Button
              type="button"
              size="sm"
              onClick={() => setCopilotOpen(o => !o)}
              className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
              aria-label={copilotOpen ? 'Close Copilot' : 'Open Copilot'}
              aria-expanded={copilotOpen}
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">Copilot</span>
            </Button>}
            <Button type="button" size="sm" variant="outline" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }} aria-label="Sign out">
              <LogOut className="size-4" /> <span className="hidden md:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 lg:ml-[270px] pb-[88px] lg:pb-0">
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1500px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {activeView === 'dashboard' && (
                <DashboardView onNavigate={handleNavigate} onNewLead={() => setActiveView('leads')} onOpenLead={openLeadDetail} />
              )}
              {activeView === 'leads' && (
                <LeadsView onMeasureLead={goToMeasureForLead} openLeadId={openLeadId} onOpenLeadConsumed={() => setOpenLeadId(null)} />
              )}
              {activeView === 'measure' && (
                <MeasureView prefill={measurePrefill} onPrefillConsumed={() => setMeasurePrefill(null)} />
              )}
              {activeView === 'crm' && <div data-tut="crm"><CrmView openLeadId={initialSession.role === 'setter' || initialSession.role === 'sales' ? openLeadId : null} onOpenConsumed={() => setOpenLeadId(null)} /></div>}
              {activeView === 'photo-bank' && <div data-tut="photo-bank"><PhotoBankView /></div>}
              {activeView === 'employees' && <div data-tut="employees"><EmployeesView /></div>}
              {activeView === 'estimates' && <EstimatesView />}
              {activeView === 'jobs' && <JobsView />}
              {activeView === 'materials' && <MaterialsView />}
              {activeView === 'pricing' && <PricingView />}
              {activeView === 'route-map' && <RouteMapView canUseAi={initialSession.role !== 'setter'} onOpenLead={openLeadDetail} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky footer (desktop) */}
      <footer className="hidden lg:block mt-auto bg-gradient-to-r from-[#071321] via-[#0c1a2c] to-[#071321] border-t border-[#183354] lg:ml-[270px]">
        <div className="px-6 lg:px-8 py-3 flex items-center justify-between gap-4 max-w-[1500px] mx-auto">
          <div className="flex items-center gap-2 text-[#e2ebf5]">
            <Compass className="size-4 text-[#40d4ff]" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wide">True North Field OS</span>
            <span className="text-[#40d4ff]/60 text-xs">·</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#e2ebf5]/60">Operating Loop</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-[#102238] border border-[#183354] text-[10px] text-[#e2ebf5]/90 font-medium">
                  {s}
                </span>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className="size-3 text-[#40d4ff]/60" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#071321] border-t border-[#183354] overflow-x-auto"
        style={{ height: 72 }}
      >
        <ul className="flex items-center gap-1 px-2 py-2 min-w-max">
          {availableViews.map(v => {
            const Icon = v.icon
            const active = v.id === activeView
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => handleNavigate(v.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex flex-col items-center justify-center gap-0.5 px-3.5 py-1.5 rounded-lg min-w-[64px] transition-colors ${
                    active ? 'text-[#40d4ff] bg-[#0084ff]/15' : 'text-[#e2ebf5]/60'
                  }`}
                >
                  {active && (
                    <span
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#40d4ff]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium leading-none">{v.shortLabel}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Copilot drawer */}
      {initialSession.role !== 'setter' && <CopilotDrawer
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
        onNavigate={(view) => { handleNavigate(view as ViewId); setCopilotOpen(false) }}
        onOpenLead={(leadId) => { openLeadDetail(leadId); setCopilotOpen(false) }}
      />}

      {/* Tutorial overlay */}
      <TutorialOverlay
        steps={tutorialSteps}
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
    </div>
  )
}

export { PIPELINE_STEPS, VIEWS }
