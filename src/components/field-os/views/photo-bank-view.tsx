'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, ImagePlus, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, type Lead, type PhotoAsset } from '@/lib/tn-api'
import { compressImage } from '@/lib/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function PhotoBankView() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [leadId, setLeadId] = useState('')
  const [title, setTitle] = useState('Roof photo')
  const leadsQ = useQuery({ queryKey: ['leads'], queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads') })
  const photosQ = useQuery({ queryKey: ['photo-bank'], queryFn: () => apiGet<{ photos: PhotoAsset[] }>('/api/photo-bank') })
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const lead = leadsQ.data?.leads.find(l => l.id === leadId)
      if (!lead) throw new Error('Select an address before uploading.')
      const dataUrl = await compressImage(file)
      return apiPost('/api/photo-bank', { leadId, address: [lead.street, lead.city, lead.state, lead.zip].filter(Boolean).join(', '), title, category: 'roof' , dataUrl })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['photo-bank'] }); toast.success('Photo saved to photo bank'); if (inputRef.current) inputRef.current.value = '' },
    onError: (e: Error) => toast.error('Photo upload failed', { description: e.message }),
  })
  const photos = useMemo(() => {
    const term = search.trim().toLowerCase(); const list = photosQ.data?.photos || []
    if (!term) return list
    return list.filter(p => [p.address, p.title, p.category].some(v => String(v || '').toLowerCase().includes(term)))
  }, [photosQ.data?.photos, search])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#071321]">Photo Bank</h2>
        <p className="text-sm text-slate-500">Keep roof photos attached to the property. AI inspection photos appear here automatically.</p>
      </div>
      <Card className="border-[#d6e2ee]">
        <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5"><Label>Property / address</Label><Select value={leadId} onValueChange={setLeadId}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{(leadsQ.data?.leads || []).map(l => <SelectItem key={l.id} value={l.id}>{l.street} — {l.name || 'Homeowner'}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="photo-title">Photo label</Label><Input id="photo-title" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadMut.mutate(f) }} /><Button type="button" className="w-full bg-[#0084ff] hover:bg-[#0070e0] text-white" disabled={!leadId || uploadMut.isPending} onClick={() => inputRef.current?.click()}><ImagePlus className="size-4" /> {uploadMut.isPending ? 'Saving…' : 'Add Photo'}</Button></div>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 max-w-md"><Search className="size-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search address, label, or category" /></div>
      {!photosQ.isLoading && photos.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-slate-500">No photos yet. Upload the first property photo above or run an AI inspection.</CardContent></Card> : null}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {photos.map(p => <Card key={p.id} className="overflow-hidden border-[#d6e2ee]"><div className="aspect-[4/3] bg-[#071321]"><img src={p.dataUrl} alt={p.title || p.address} className="w-full h-full object-cover" loading="lazy" /></div><CardContent className="p-3 space-y-2"><div className="font-semibold text-xs text-[#071321] truncate">{p.title}</div><div className="text-[11px] text-slate-500 line-clamp-2">{p.address}</div><PhotoTypeBadge category={p.category} /></CardContent></Card>)}
      </div>
    </div>
  )
}

function PhotoTypeBadge({ category }: { category: string }) { const Icon = category === 'ai-inspection' ? Sparkles : Camera; return <Badge variant="outline" className="text-[10px] gap-1"><Icon className="size-3" /> {category}</Badge> }
