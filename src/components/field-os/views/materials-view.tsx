'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  RefreshCw,
  ShieldCheck,
  Tag,
  Save,
  DollarSign,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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
  fmtMoneyDetail,
  fmtDateTime,
  type CatalogResponse,
  type SupplierPrice,
} from '@/lib/tn-api'

export function MaterialsView() {
  const catalogQ = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<CatalogResponse>('/api/catalog'),
  })
  const pricesQ = useQuery({
    queryKey: ['prices'],
    queryFn: () => apiGet<{ prices: SupplierPrice[] }>('/api/prices'),
  })

  const products = catalogQ.data?.catalog || []
  const prices = pricesQ.data?.prices || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
      {/* IKO Catalog */}
      <Card data-tut="catalog" className="border-[#d6e2ee]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-lg bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center">
                <Package className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base text-[#071321]">Official IKO Catalog</CardTitle>
                <CardDescription>Central Ohio field spec — Dynasty, Cambridge, Nordic.</CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info('Catalog is the official IKO spec — synced.')}
            >
              <RefreshCw className="size-3.5" /> Sync Specs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {catalogQ.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : (
            <ul className="space-y-3 max-h-[600px] overflow-y-auto pr-1 -mr-1">
              {products.map(p => (
                <li key={p.id} className="rounded-lg border border-[#d6e2ee] p-3 bg-white hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#071321] text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{p.description}</div>
                    </div>
                    <Badge variant="outline" className="bg-[#0084ff]/5 text-[#0084ff] border-[#0084ff]/20 shrink-0">
                      <ShieldCheck className="size-3" /> {p.classRating}
                    </Badge>
                  </div>
                  <Separator className="my-2.5" />
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <Spec label="Warranty" value={p.warranty} />
                    <Spec label="Exposure" value={p.exposure} />
                    <Spec label="Wind" value={p.windRating} />
                  </div>
                  <div className="mt-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Colors</div>
                    <div className="flex flex-wrap gap-1">
                      {p.colors.map(c => (
                        <span key={c} className="px-1.5 py-0.5 rounded-full bg-[#f5f8fc] border border-[#d6e2ee] text-[10px] text-slate-600 font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Supplier Pricing */}
      <Card data-tut="prices" className="border-[#d6e2ee]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-[#10b981]/10 text-[#10b981] flex items-center justify-center">
              <Tag className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base text-[#071321]">Distributor / Supplier Pricing</CardTitle>
              <CardDescription>Verified $/square quotes flow into every estimate.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="rounded-md border border-[#10b981]/20 bg-[#10b981]/5 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#10b981] font-semibold">
              <ShieldCheck className="size-3" /> Verified Supplier Prices
              <span className="ml-auto text-[#071321] font-bold text-base">{prices.length}</span>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 -mr-1 space-y-1.5">
            {pricesQ.isLoading ? (
              [0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)
            ) : prices.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500 border border-dashed border-[#d6e2ee] rounded-lg">
                No verified quotes yet. Save your first below.
              </div>
            ) : (
              prices.map(p => (
                <div key={p.id} className="rounded-md border border-[#d6e2ee] bg-white p-2 text-xs flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#071321] truncate">
                      {p.product.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      {p.color && <span className="text-slate-500 font-normal"> · {p.color}</span>}
                    </div>
                    <div className="text-slate-500 text-[10px] truncate">{p.supplier} · {p.item || 'no SKU'} · {fmtDateTime(p.savedAt)}</div>
                  </div>
                  <div className="font-bold text-[#071321] shrink-0">{fmtMoneyDetail(p.price)}/sq</div>
                </div>
              ))
            )}
          </div>

          <SupplierPriceForm products={products} />
        </CardContent>
      </Card>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-[#071321] font-medium">{value}</div>
    </div>
  )
}

function SupplierPriceForm({ products }: { products: CatalogResponse['catalog'] }) {
  const qc = useQueryClient()
  const [product, setProduct] = useState('')
  const [color, setColor] = useState('all')
  const [price, setPrice] = useState('')
  const [supplier, setSupplier] = useState('ABC Supply — Columbus/Newark')
  const [item, setItem] = useState('')

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost('/api/prices', body),
    onSuccess: () => {
      toast.success('Verified quote saved', { description: 'Will be used in future estimate calculations.' })
      qc.invalidateQueries({ queryKey: ['prices'] })
      qc.invalidateQueries({ queryKey: ['catalog'] })
      setPrice('')
      setItem('')
    },
    onError: (e: Error) => toast.error('Failed to save quote', { description: e.message }),
  })

  const handleSave = () => {
    const p = Number(price)
    if (!product) { toast.error('Select an IKO product'); return }
    if (!Number.isFinite(p) || p <= 0) { toast.error('Enter a valid $/square price'); return }
    saveMut.mutate({
      product,
      color: color === 'all' ? '' : color,
      price: p,
      supplier,
      item,
    })
  }

  const selectedProduct = products.find(p => p.id === product)

  return (
    <div className="rounded-lg border border-[#d6e2ee] p-3 space-y-2.5 bg-[#f5f8fc]">
      <div className="text-xs font-semibold text-[#071321] uppercase tracking-wide flex items-center gap-1.5">
        <DollarSign className="size-3.5" /> Save a Verified Quote
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label htmlFor="sp-product" className="text-xs">IKO Product</Label>
          <Select value={product} onValueChange={v => { setProduct(v); setColor('all') }}>
            <SelectTrigger id="sp-product" className="w-full h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent>
              {products.map(p => <SelectItem key={p.id} value={p.id}>{p.shortName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label htmlFor="sp-color" className="text-xs">Color</Label>
          <Select value={color} onValueChange={setColor} disabled={!selectedProduct}>
            <SelectTrigger id="sp-color" className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colors</SelectItem>
              {(selectedProduct?.colors || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-price" className="text-xs">Verified Price/Square ($)</Label>
          <Input id="sp-price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="135.00" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sp-item" className="text-xs">Item SKU</Label>
          <Input id="sp-item" value={item} onChange={e => setItem(e.target.value)} placeholder="Dyn-Glacier-ABCS" className="h-8 text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label htmlFor="sp-supplier" className="text-xs">Supplier</Label>
          <Input id="sp-supplier" value={supplier} onChange={e => setSupplier(e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="w-full bg-[#10b981] hover:bg-[#0ea368] text-white"
        onClick={handleSave}
        disabled={saveMut.isPending}
      >
        <Save className="size-3.5" /> {saveMut.isPending ? 'Saving…' : 'Save Verified Quote'}
      </Button>
    </div>
  )
}
