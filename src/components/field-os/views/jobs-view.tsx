'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Hammer,
  Calendar,
  Wrench,
  CheckCircle2,
  DollarSign,
  Paperclip,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  apiGet,
  apiPatch,
  fmtMoney,
  fmtDate,
  type Job,
} from '@/lib/tn-api'

const STATUS_TONES: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-zinc-100 text-zinc-700 border-zinc-200',
}

const STATUS_ICON: Record<string, typeof Calendar> = {
  scheduled: Calendar,
  in_progress: Wrench,
  completed: CheckCircle2,
  cancelled: Hammer,
}

export function JobsView() {
  const qc = useQueryClient()
  const [econJob, setEconJob] = useState<Job | null>(null)

  const jobsQ = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiGet<{ jobs: Job[] }>('/api/jobs'),
  })

  if (jobsQ.isLoading) {
    return (
      <Card className="border-[#d6e2ee]">
        <CardContent className="p-4 space-y-2">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  const jobs = jobsQ.data?.jobs || []

  // Upcoming jobs: scheduled/in_progress jobs with a startDate today or later
  const upcomingJobs = jobs
    .filter(j => ['scheduled', 'in_progress'].includes(j.status) && j.startDate)
    .map(j => {
      const startDate = new Date(j.startDate as string)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const daysOut = Math.round((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
      return { ...j, daysOut }
    })
    .filter(j => j.daysOut >= 0)
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 4)

  if (jobs.length === 0) {
    return (
      <Card className="border-[#d6e2ee]">
        <CardContent className="p-10 text-center">
          <Hammer className="size-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[#071321]">No jobs yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4 max-w-sm mx-auto">
            Jobs are created when you attach a signed contract to an accepted estimate. Head to the Estimates view to start one.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Upcoming jobs — scheduled jobs sorted by start date */}
      {upcomingJobs.length > 0 && (
        <Card className="border-[#0084ff]/20 bg-gradient-to-br from-[#f0f7ff] to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="size-8 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center">
                <Calendar className="size-4" aria-hidden="true" />
              </span>
              <div>
                <div className="text-sm font-bold text-[#071321]">Upcoming Jobs</div>
                <div className="text-xs text-slate-500">
                  {upcomingJobs.length} job{upcomingJobs.length === 1 ? '' : 's'} scheduled in the coming days.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {upcomingJobs.map(j => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setEconJob(jobs.find(x => x.id === j.id) || null)}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-[#0084ff]/15 bg-white hover:border-[#0084ff]/40 hover:shadow-sm transition-all text-left"
                >
                  <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${j.daysOut === 0 ? 'bg-amber-100 text-amber-600' : 'bg-[#0084ff]/10 text-[#0084ff]'}`}>
                    <Calendar className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#071321] truncate flex items-center gap-1">
                      <MapPin className="size-3 text-slate-400 shrink-0" />
                      <span className="truncate">{j.property}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-bold text-[#071321]">{fmtMoney(j.contractValue)}</span>
                      <span>·</span>
                      <span className={j.daysOut === 0 ? 'text-amber-600 font-semibold' : ''}>
                        {j.daysOut === 0 ? 'Today' : j.daysOut === 1 ? 'Tomorrow' : `in ${j.daysOut} days`}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                    {j.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-tut="table" className="border-[#d6e2ee]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f5f8fc] hover:bg-[#f5f8fc]">
                <TableHead className="pl-4">Job #</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Contract Value</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Cash Collected</TableHead>
                <TableHead className="hidden md:table-cell text-right">Open Balance</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Margin</TableHead>
                <TableHead data-tut="actions" className="text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => {
                const actualMargin = job.contractValue > 0
                  ? ((job.contractValue - job.actualCost) / job.contractValue) * 100
                  : 0
                const StatusIcon = STATUS_ICON[job.status] || Calendar
                return (
                  <TableRow key={job.id}>
                    <TableCell className="pl-4 font-mono text-xs text-slate-600">
                      #{job.id.slice(-6).toUpperCase()}
                      <div className="text-[10px] text-slate-400 font-sans">{fmtDate(job.createdAt)}</div>
                    </TableCell>
                    <TableCell className="font-medium text-[#071321] text-sm max-w-[240px]">
                      <div className="truncate" title={job.property}>{job.property}</div>
                      {job.contractFilename && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 max-w-full">
                          <Paperclip className="size-2.5 shrink-0" />
                          <span className="truncate">{job.contractFilename}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONES[job.status] || STATUS_TONES.scheduled}>
                        <StatusIcon className="size-3" />
                        <span className="capitalize">{job.status.replace(/_/g, ' ')}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-[#071321]">{fmtMoney(job.contractValue)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-emerald-700 font-medium">
                      {fmtMoney(job.cashCollected)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-slate-600">
                      {fmtMoney(job.balance)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right">
                      <Badge variant="outline" className={actualMargin >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                        {actualMargin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button size="sm" variant="outline" onClick={() => setEconJob(job)}>
                        <DollarSign className="size-3.5" /> Economics
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {econJob && (
        <JobEconomicsDialog
          job={econJob}
          onClose={() => setEconJob(null)}
        />
      )}
    </>
  )
}

function JobEconomicsDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const qc = useQueryClient()
  const [actualCost, setActualCost] = useState(String(job.actualCost || 0))
  const [cashCollected, setCashCollected] = useState(String(job.cashCollected || 0))
  const [status, setStatus] = useState<string>(job.status)
  const [startDate, setStartDate] = useState<string>(
    job.startDate ? new Date(job.startDate).toISOString().slice(0, 10) : ''
  )

  const updateMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch(`/api/jobs/${job.id}`, body),
    onSuccess: () => {
      toast.success('Job economics updated')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['metrics'] })
      onClose()
    },
    onError: (e: Error) => toast.error('Failed to update job', { description: e.message }),
  })

  const balance = Math.max(0, Number(job.contractValue) - (Number(cashCollected) || 0))
  const projectedMargin = job.contractValue > 0
    ? ((job.contractValue - (Number(actualCost) || 0)) / job.contractValue) * 100
    : 0

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hammer className="size-5 text-[#0084ff]" /> Job Economics
          </DialogTitle>
          <DialogDescription>
            #{job.id.slice(-6).toUpperCase()} · {job.property}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-[#d6e2ee] bg-[#f5f8fc] p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Contract Value</div>
              <div className="text-lg font-bold text-[#071321]">{fmtMoney(job.contractValue)}</div>
            </div>
            <div className="rounded-md border border-[#d6e2ee] bg-[#f5f8fc] p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Contract File</div>
              <div className="text-sm font-medium text-[#071321] truncate" title={job.contractFilename || ''}>
                {job.contractFilename || '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="je-cost">Actual costs ($)</Label>
              <Input id="je-cost" type="number" min="0" step="0.01" value={actualCost} onChange={e => setActualCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="je-cash">Cash collected ($)</Label>
              <Input id="je-cash" type="number" min="0" step="0.01" value={cashCollected} onChange={e => setCashCollected(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="je-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="je-status" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="je-start-date">Scheduled start date</Label>
            <Input
              id="je-start-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* Cash collection progress */}
          <div className="rounded-md border border-[#d6e2ee] bg-[#f5f8fc] p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-slate-600 uppercase tracking-wide">Cash Collection</span>
              <span className="text-[#071321] font-semibold">
                {fmtMoney(Number(cashCollected) || 0)} <span className="text-slate-400 font-normal">/ {fmtMoney(job.contractValue)}</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${Math.min(100, job.contractValue > 0 ? ((Number(cashCollected) || 0) / Number(job.contractValue)) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1.5 text-slate-500">
              <span>Open balance: <span className="font-semibold text-[#071321]">{fmtMoney(balance)}</span></span>
              <span>{job.contractValue > 0 ? Math.round(((Number(cashCollected) || 0) / Number(job.contractValue)) * 100) : 0}% collected</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-[#d6e2ee] p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Open Balance</div>
              <div className="text-base font-bold text-[#071321]">{fmtMoney(balance)}</div>
            </div>
            <div className="rounded-md border border-[#d6e2ee] p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Projected Margin</div>
              <div className={`text-base font-bold ${projectedMargin >= 30 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {projectedMargin.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={updateMut.isPending}>Close</Button>
          <Button
            className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
            onClick={() => updateMut.mutate({
              actualCost: Number(actualCost) || 0,
              cashCollected: Number(cashCollected) || 0,
              status,
              startDate: startDate || null,
            })}
            disabled={updateMut.isPending}
          >
            {updateMut.isPending ? 'Saving…' : 'Update Job Economics'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
