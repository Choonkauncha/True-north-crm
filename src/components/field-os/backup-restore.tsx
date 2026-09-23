'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { apiPost } from '@/lib/tn-api'

export function BackupRestore() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<unknown>(null)
  const [pendingName, setPendingName] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)

  const handleBackup = async () => {
    setBackupBusy(true)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `Backup failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Pick a friendly filename
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `true_north_fieldos_backup_${ts}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded', {
        description: 'Saved a full JSON dump of all leads, estimates, jobs, profiles, and prices.',
      })
    } catch (e) {
      toast.error('Backup failed', { description: (e as Error).message })
    } finally {
      setBackupBusy(false)
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setPendingName(file.name)
      setPendingRestore(parsed)
    } catch (e) {
      toast.error('Invalid backup file', { description: (e as Error).message })
    }
  }

  const confirmRestore = async () => {
    if (!pendingRestore) return
    setRestoreBusy(true)
    try {
      const data = await apiPost<{ counts: Record<string, number> }>('/api/backup', pendingRestore)
      toast.success('Restore complete', {
        description: `Leads: ${data.counts.leads}, Estimates: ${data.counts.estimates}, Jobs: ${data.counts.jobs}, Profiles: ${data.counts.profiles}, Prices: ${data.counts.prices}`,
      })
      qc.invalidateQueries()
      setPendingRestore(null)
      setPendingName('')
    } catch (e) {
      toast.error('Restore failed', { description: (e as Error).message })
    } finally {
      setRestoreBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleBackup}
        disabled={backupBusy}
        aria-label="Download backup"
      >
        {backupBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        <span className="hidden md:inline">Backup</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={restoreBusy}
        aria-label="Restore from backup"
      >
        <Upload className="size-4" />
        <span className="hidden md:inline">Restore</span>
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <AlertDialog open={!!pendingRestore} onOpenChange={o => !o && setPendingRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will upsert every record in <span className="font-medium text-[#071321]">{pendingName}</span> into the local database. Existing records with the same ID will be overwritten. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
              onClick={e => { e.preventDefault(); confirmRestore() }}
              disabled={restoreBusy}
            >
              {restoreBusy ? 'Restoring…' : 'Restore Backup'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
