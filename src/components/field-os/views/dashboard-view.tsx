'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Users,
  FileText,
  Hammer,
  DollarSign,
  Plus,
  Ruler,
  Compass,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  ClipboardList,
  TrendingUp,
  Activity as ActivityIcon,
  CheckCircle2,
  Camera,
  AlertTriangle,
  Clock,
  MapPin,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  apiGet,
  fmtMoney,
  fmtDateTime,
  stageBadgeClasses,
  stageLabel,
  type Lead,
  type Job,
  type MetricsResponse,
  type ActivityItem,
  type StaleLead,
  type TerritoryStat,
} from '@/lib/tn-api'
import type { ViewId } from '@/components/field-os/field-os-app'

const PIPELINE_STEPS = [
  'Lead',
  'Inspection',
  'Verified Area',
  'IKO Proposal',
  'Signed Contract',
  'Job Cash Flow',
]

const RULES = [
  'No estimate goes out without a field-verified roof area and pitch.',
  'No job is created without a signed contract — accepted estimates are not contracts.',
  'Every proposal must use a real-cost pricing profile, not a guess.',
  'IKO Dynasty for high-wind damage; Nordic for hail impact; Cambridge for value re-roofs.',
  'Cash collected is tracked against contract value — no job is "done" until the balance is zero.',
]

const ACTIVITY_ICON: Record<ActivityItem['type'], LucideIcon> = {
  lead_created: Users,
  lead_stage: ArrowUpRight,
  estimate_created: FileText,
  estimate_accepted: CheckCircle2,
  job_created: Hammer,
  job_completed: CheckCircle2,
  inspection: Camera,
}

const ACTIVITY_COLOR: Record<ActivityItem['type'], string> = {
  lead_created: '#0084ff',
  lead_stage: '#8b5cf6',
  estimate_created: '#f59e0b',
  estimate_accepted: '#10b981',
  job_created: '#06b6d4',
  job_completed: '#10b981',
  inspection: '#ec4899',
}

const chartConfig = {
  revenue: { label: 'Revenue', color: '#0084ff' },
  cost: { label: 'Cost', color: '#94a3b8' },
} satisfies ChartConfig

interface DashboardViewProps {
  onNavigate: (v: ViewId) => void
  onNewLead: () => void
  onOpenLead: (leadId: string) => void
}

export function DashboardView({ onNavigate, onNewLead, onOpenLead }: DashboardViewProps) {
  const metricsQ = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiGet<MetricsResponse>('/api/metrics'),
  })

  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads'),
  })

  const jobsQ = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiGet<{ jobs: Job[] }>('/api/jobs'),
  })

  const priorityQueue = (leadsQ.data?.leads || [])
    .filter(l => !['job_complete', 'lost', 'do_not_contact', 'future'].includes(l.stage))
    .slice(0, 6)

  const m = metricsQ.data
  const loading = metricsQ.isLoading || leadsQ.isLoading
  const recentActivity = m?.recentActivity || []
  const revenueTrend = m?.revenueTrend || []
  const hasRevenueData = revenueTrend.some(p => p.revenue > 0 || p.jobCount > 0)
  const staleLeads = m?.staleLeads || []
  const territoryStats = m?.territoryStats || []

  // Jobs scheduled for today (startDate is today)
  const todayJobs = (jobsQ.data?.jobs || []).filter(j => {
    if (!j.startDate || !['scheduled', 'in_progress'].includes(j.status)) return false
    const d = new Date(j.startDate)
    const today = new Date()
    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
  })

  // "Due Today" items: today's jobs + top 3 stale leads
  const dueTodayCount = todayJobs.length + Math.min(staleLeads.length, 3)

  return (
    <div className="space-y-5">
      {/* Hero pipeline card */}
      <Card
        data-tut="pipeline"
        className="border-0 bg-gradient-to-br from-[#071321] via-[#0c1a2c] to-[#050d18] text-white overflow-hidden"
      >
        <CardContent className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[#40d4ff] text-[11px] uppercase tracking-[0.18em] font-semibold mb-1.5">
                <Compass className="size-3.5" aria-hidden="true" />
                True North Operating Loop
              </div>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                From door knock to cash in the bank.
              </h2>
              <p className="text-sm text-[#e2ebf5]/70 mt-1.5">
                Every job moves through these six stages — keep the loop moving and the cash follows.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
                onClick={onNewLead}
              >
                <Plus className="size-4" aria-hidden="true" /> New Lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
                onClick={() => onNavigate('measure')}
              >
                <Ruler className="size-4" aria-hidden="true" /> Measure / Estimate
              </Button>
            </div>
          </div>

          {/* Pipeline pills */}
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-full bg-[#102238] border border-[#183354] text-xs text-[#e2ebf5] font-medium flex items-center gap-1.5">
                  <span className="size-4 rounded-full bg-[#0084ff]/15 border border-[#40d4ff]/30 text-[10px] text-[#40d4ff] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  {s}
                </span>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight className="size-3.5 text-[#40d4ff]/60" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Due Today card — daily standup view combining today's jobs + stale leads */}
      {!loading && dueTodayCount > 0 && (
        <Card className="border-[#0084ff]/30 bg-gradient-to-br from-[#f0f7ff] via-white to-[#f0f7ff]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-9 rounded-lg bg-[#0084ff] text-white flex items-center justify-center shadow-md shadow-[#0084ff]/20">
                <CalendarCheck className="size-4.5" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-[#071321] flex items-center gap-2">
                  Due Today
                  <Badge variant="outline" className="text-[10px] bg-[#0084ff] text-white border-[#0084ff]">
                    {dueTodayCount}
                  </Badge>
                </div>
                <div className="text-xs text-slate-500">
                  {todayJobs.length > 0 && `${todayJobs.length} job${todayJobs.length === 1 ? '' : 's'} scheduled`}
                  {todayJobs.length > 0 && staleLeads.length > 0 && ' · '}
                  {staleLeads.length > 0 && `${Math.min(staleLeads.length, 3)} lead${staleLeads.length === 1 ? '' : 's'} needing attention`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Today's jobs */}
              {todayJobs.map(job => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onNavigate('jobs')}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-[#0084ff]/20 bg-white hover:border-[#0084ff]/50 hover:shadow-sm transition-all text-left"
                >
                  <div className="size-9 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center shrink-0">
                    <Hammer className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#071321] truncate">{job.property}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-bold text-[#071321]">{fmtMoney(job.contractValue)}</span>
                      <span>·</span>
                      <span className="capitalize">{job.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <ArrowUpRight className="size-3.5 text-slate-400 shrink-0 mt-1" aria-hidden="true" />
                </button>
              ))}

              {/* Stale leads (top 3) */}
              {staleLeads.slice(0, 3).map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onOpenLead(lead.id)}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-sm transition-all text-left"
                >
                  <div className="size-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#071321] truncate">{lead.street}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{lead.stage.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span className="font-bold text-amber-600">{lead.daysInStage}d overdue</span>
                    </div>
                  </div>
                  <ArrowUpRight className="size-3.5 text-slate-400 shrink-0 mt-1" aria-hidden="true" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div data-tut="kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Total Leads"
          value={loading ? null : String(m?.totalLeads ?? 0)}
          icon={Users}
          color="#0084ff"
          hint="All-time captured"
          trend={m?.kpiTrends?.leads}
        />
        <KpiCard
          label="Contracted"
          value={loading ? null : String(m?.contractedLeads ?? 0)}
          icon={ShieldCheck}
          color="#10b981"
          hint="Signed contracts"
          trend={m?.kpiTrends?.contracted}
        />
        <KpiCard
          label="Pending Proposals"
          value={loading ? null : String(m?.pendingEstimates ?? 0)}
          icon={FileText}
          color="#8b5cf6"
          hint="Awaiting acceptance"
          trend={m?.kpiTrends?.pending}
        />
        <KpiCard
          label="Contract Value"
          value={loading ? null : fmtMoney(m?.totalRevenue ?? 0)}
          icon={DollarSign}
          color="#f59e0b"
          hint={`Cash collected ${fmtMoney(m?.totalCashCollected ?? 0)}`}
          trend={m?.kpiTrends?.revenue}
          isCurrency
        />
      </div>

      {/* Stale leads callout — surfaces pipeline items needing attention */}
      {!loading && staleLeads.length > 0 && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#071321]">Leads Needing Attention</div>
                <div className="text-xs text-slate-500">
                  {staleLeads.length} lead{staleLeads.length === 1 ? '' : 's'} stuck in a stage for 7+ days. Move them forward to keep the loop flowing.
                </div>
              </div>
            </div>
            <ul className="space-y-1.5">
              {staleLeads.map(lead => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => onOpenLead(lead.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-amber-200/60 bg-white hover:border-amber-300 hover:shadow-sm transition-all text-left cursor-pointer"
                    title={`Open ${lead.street} detail`}
                  >
                    <div className="size-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Clock className="size-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#071321] truncate">{lead.street}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {lead.name || 'Unknown'} · {lead.nextAction || 'No next action set'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${stageBadgeClasses(lead.stage)}`}>
                        {stageLabel(lead.stage)}
                      </Badge>
                      <span className="text-xs font-bold text-amber-600 whitespace-nowrap">
                        {lead.daysInStage}d
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Revenue trend chart + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card className="lg:col-span-2 border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-[#071321]">
              <TrendingUp className="size-4 text-[#0084ff]" aria-hidden="true" />
              Revenue &amp; Margin Trend
            </CardTitle>
            <CardDescription>6-month rolling contract revenue with average margin.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : hasRevenueData ? (
              <>
                <ChartContainer config={chartConfig} className="h-44 w-full">
                  <BarChart data={revenueTrend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2ebf5" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={48} tickFormatter={(v: number) => `$${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  {revenueTrend.filter(p => p.jobCount > 0).slice(-3).map(p => (
                    <div key={p.month} className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">{p.month}:</span>
                      <span className="font-semibold text-[#071321]">{fmtMoney(p.revenue)}</span>
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${p.margin >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {p.margin}%
                      </Badge>
                    </div>
                  ))}
                  {revenueTrend.filter(p => p.jobCount > 0).length === 0 && (
                    <span className="text-xs text-slate-400">No jobs recorded yet this period.</span>
                  )}
                </div>
              </>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center">
                <TrendingUp className="size-8 text-slate-300 mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-slate-600">No revenue data yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Close your first job to populate the 6-month revenue and margin trend.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-[#071321]">
              <ActivityIcon className="size-4 text-[#10b981]" aria-hidden="true" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest moves across the pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-6 text-center">
                <ActivityIcon className="size-8 text-slate-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-500">No activity yet.</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1 -mr-1">
                {recentActivity.map((a, i) => {
                  const Icon = ACTIVITY_ICON[a.type] || ActivityIcon
                  const color = ACTIVITY_COLOR[a.type] || '#64748b'
                  return (
                    <li key={`${a.refId}-${i}`} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#f5f8fc] transition-colors">
                      <span
                        className="size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#071321] leading-tight">{a.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{a.detail}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(a.timestamp)}</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions (mobile-friendly) */}
      <div data-tut="quickactions" className="flex flex-wrap gap-2 sm:hidden">
        <Button size="sm" className="bg-[#0084ff] hover:bg-[#0070e0] text-white" onClick={onNewLead}>
          <Plus className="size-4" /> New Lead
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('measure')}>
          <Ruler className="size-4" /> Measure / Estimate
        </Button>
        <Button size="sm" variant="outline" onClick={() => onNavigate('leads')}>
          View Pipeline <ArrowUpRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Today's Contract Queue */}
        <Card data-tut="queue" className="lg:col-span-2 border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-[#071321]">
              <ClipboardList className="size-4 text-[#0084ff]" aria-hidden="true" />
              Today&apos;s Contract Queue
            </CardTitle>
            <CardDescription>The next 6 active leads, ranked by what action is owed.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : priorityQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#d6e2ee] p-6 text-center">
                <Users className="size-8 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#071321]">No active leads yet</p>
                <p className="text-xs text-slate-500 mt-1 mb-3">Capture your first door-knock to start the operating loop.</p>
                <Button size="sm" className="bg-[#0084ff] hover:bg-[#0070e0] text-white" onClick={onNewLead}>
                  <Plus className="size-4" /> New Lead
                </Button>
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1 -mr-1">
                {priorityQueue.map(lead => (
                  <li
                    key={lead.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-[#e5edf5] bg-white hover:border-[#c3d6ea] hover:shadow-sm transition-all"
                  >
                    <div className="size-9 rounded-lg bg-[#071321] text-[#40d4ff] font-bold text-sm flex items-center justify-center shrink-0">
                      {(lead.name || lead.street || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#071321] truncate">
                        {lead.street}{lead.city ? `, ${lead.city}` : ''}{lead.state ? `, ${lead.state}` : ''}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {lead.name || 'Unknown customer'} · {lead.nextAction || 'No next action set'}
                      </div>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${stageBadgeClasses(lead.stage)}`}>
                      {stageLabel(lead.stage)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Operating Rules */}
        <Card data-tut="rules" className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-[#071321]">
              <ShieldCheck className="size-4 text-[#10b981]" aria-hidden="true" />
              True North Operating Rules
            </CardTitle>
            <CardDescription>Five non-negotiables.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="space-y-2.5">
              {RULES.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="size-5 rounded-full bg-[#0084ff]/10 border border-[#0084ff]/20 text-[#0084ff] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-slate-700 leading-relaxed">{r}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Stage breakdown (extra context) */}
      {!loading && m && (m.totalLeads ?? 0) > 0 && (
        <Card className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#071321]">Pipeline Stage Breakdown</CardTitle>
            <CardDescription>Leads distributed across the 12 operating-loop stages.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Visual distribution bar */}
            {(() => {
              const total = Object.values(m.stageCounts || {}).reduce((a, b) => a + b, 0)
              if (total === 0) return null
              const stageColors: Record<string, string> = {
                new: '#64748b',
                contacted: '#0084ff',
                inspection_set: '#06b6d4',
                inspection_complete: '#f59e0b',
                estimate_sent: '#8b5cf6',
                follow_up: '#fb923c',
                contracted: '#10b981',
                job_open: '#059669',
                job_complete: '#16a34a',
                lost: '#ef4444',
                future: '#94a3b8',
                do_not_contact: '#71717a',
              }
              const activeStages = Object.entries(m.stageCounts || {}).filter(([, c]) => c > 0)
              return (
                <div className="mb-4">
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100" role="img" aria-label="Pipeline distribution bar">
                    {activeStages.map(([stage, count]) => (
                      <div
                        key={stage}
                        style={{ width: `${(count / total) * 100}%`, backgroundColor: stageColors[stage] || '#94a3b8' }}
                        title={`${stageLabel(stage)}: ${count}`}
                      />
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5">{total} total lead{total === 1 ? '' : 's'} across {activeStages.length} active stage{activeStages.length === 1 ? '' : 's'}</div>
                </div>
              )
            })()}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(m.stageCounts || {}).map(([stage, count]) => (
                <Badge
                  key={stage}
                  variant="outline"
                  className={`gap-1.5 ${stageBadgeClasses(stage)} ${count === 0 ? 'opacity-40' : ''}`}
                >
                  {stageLabel(stage)} <span className="font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Territory breakdown — leads + revenue per territory */}
      {!loading && territoryStats.length > 0 && (
        <Card className="border-[#d6e2ee]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-[#071321]">
              <MapPin className="size-4 text-[#0084ff]" aria-hidden="true" />
              Territory Breakdown
            </CardTitle>
            <CardDescription>Leads, contracts, and revenue by territory.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {territoryStats.map(t => (
                <div
                  key={t.territory}
                  className="rounded-lg border border-[#e5edf5] bg-white p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="size-3 text-[#0084ff]" aria-hidden="true" />
                    <div className="text-sm font-bold text-[#071321] truncate">{t.territory}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Leads</div>
                      <div className="text-sm font-bold text-[#071321]">{t.leads}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Contracted</div>
                      <div className="text-sm font-bold text-emerald-700">{t.contracted}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Jobs</div>
                      <div className="text-sm font-bold text-[#071321]">{t.jobs}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Revenue</div>
                      <div className="text-sm font-bold text-[#f59e0b]">{fmtMoney(t.revenue)}</div>
                    </div>
                  </div>
                  {t.leads > 0 && (
                    <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0084ff] to-[#40d4ff]"
                        style={{ width: `${t.leads > 0 ? (t.contracted / t.leads) * 100 : 0}%` }}
                        title={`${t.contracted} of ${t.leads} leads contracted`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
  trend,
  isCurrency,
}: {
  label: string
  value: string | null
  icon: LucideIcon
  color: string
  hint?: string
  trend?: number[]
  isCurrency?: boolean
}) {
  const hasTrend = trend && trend.length > 0 && trend.some(v => v > 0)
  const lastVsPrev = trend && trend.length >= 2
    ? trend[trend.length - 1] - trend[trend.length - 2]
    : 0
  const trendUp = lastVsPrev > 0
  const trendDown = lastVsPrev < 0

  return (
    <Card className="border-[#d6e2ee] hover:shadow-md transition-shadow group relative overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
          <span
            className="size-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-xl sm:text-2xl font-bold text-[#071321] tracking-tight">{value}</div>
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          {hint && <div className="text-[11px] text-slate-400 truncate">{hint}</div>}
          {hasTrend && (
            <span
              className={`text-[10px] font-semibold inline-flex items-center gap-0.5 shrink-0 ${
                trendUp ? 'text-emerald-600' : trendDown ? 'text-red-500' : 'text-slate-400'
              }`}
              title={`${trend![trend!.length - 2]} → ${trend![trend!.length - 1]} last vs prev month`}
            >
              {trendUp && <ArrowUpRight className="size-3" />}
              {trendDown && <ArrowRight className="size-3 rotate-90" />}
              {isCurrency && trend![trend!.length - 1] > 0 ? `${trend![trend!.length - 1] / 1000 >= 1 ? `${(trend![trend!.length - 1] / 1000).toFixed(1)}k` : trend![trend!.length - 1]}` : trend![trend!.length - 1]}
              {trendUp ? '/mo' : ''}
            </span>
          )}
        </div>
        {hasTrend && (
          <div className="mt-2 -mx-1">
            <Sparkline data={trend!} color={color} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Lightweight inline SVG sparkline — no external chart lib needed.
 * Renders a smooth area+line for a 6-point monthly trend.
 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 120
  const height = 28
  const padding = 2
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = (width - padding * 2) / Math.max(data.length - 1, 1)

  const points = data.map((v, i) => {
    const x = padding + i * step
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`
  const gradId = `spark-${color.replace('#', '')}`

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 2.5 : 0}
          fill={color}
        />
      ))}
    </svg>
  )
}
