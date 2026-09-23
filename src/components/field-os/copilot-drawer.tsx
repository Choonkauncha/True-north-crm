'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Send,
  Trash2,
  MessageSquare,
  Sparkles,
  Loader2,
  ArrowUpRight,
  MapPin,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  apiGet,
  apiPost,
  apiDelete,
  type CopilotMessage,
  type Lead,
} from '@/lib/tn-api'

const SUGGESTED = [
  "What's the operating loop?",
  'How do I price an IKO Dynasty roof?',
  'When can I create a job?',
]

// View names the Copilot can reference (for action chips)
const VIEW_NAMES = [
  'Command Center',
  'Leads',
  'Measure',
  'Estimates',
  'Jobs',
  'Materials',
  'Pricing',
] as const

interface CopilotDrawerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onNavigate?: (view: string) => void
  onOpenLead?: (leadId: string) => void
}

export function CopilotDrawer({ open, onOpenChange, onNavigate, onOpenLead }: CopilotDrawerProps) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const historyQ = useQuery({
    queryKey: ['copilot'],
    queryFn: () => apiGet<{ messages: CopilotMessage[] }>('/api/copilot'),
    enabled: open,
  })

  // Fetch leads so we can match street addresses mentioned in Copilot replies
  // to actual lead IDs for action chips.
  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<{ leads: Lead[] }>('/api/leads'),
    enabled: open,
  })

  // Messages come straight from the query cache as the source of truth.
  // Optimistic user messages are inserted via onMutate below.
  const messages = historyQ.data?.messages || []

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, typing])

  const sendMut = useMutation({
    mutationFn: (vars: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) =>
      apiPost<{ reply: string }>('/api/copilot', vars),
    onMutate: async (vars) => {
      // Optimistically add the user message to the cache.
      await qc.cancelQueries({ queryKey: ['copilot'] })
      const prev = qc.getQueryData<{ messages: CopilotMessage[] }>(['copilot'])
      const optimistic: CopilotMessage = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: vars.message,
        createdAt: new Date().toISOString(),
      }
      qc.setQueryData<{ messages: CopilotMessage[] }>(['copilot'], (old) => ({
        messages: [...(old?.messages || []), optimistic],
      }))
      setTyping(true)
      return { prev }
    },
    onSuccess: (data) => {
      const assistant: CopilotMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      }
      qc.setQueryData<{ messages: CopilotMessage[] }>(['copilot'], (old) => ({
        messages: [...(old?.messages || []), assistant],
      }))
      setTyping(false)
    },
    onError: (e: Error, _vars, ctx) => {
      setTyping(false)
      if (ctx?.prev) qc.setQueryData(['copilot'], ctx.prev)
      toast.error('Copilot failed to respond', { description: e.message })
    },
  })

  const clearMut = useMutation({
    mutationFn: () => apiDelete('/api/copilot'),
    onSuccess: () => {
      qc.setQueryData<{ messages: CopilotMessage[] }>(['copilot'], { messages: [] })
      toast.success('Chat cleared')
      setConfirmClear(false)
    },
    onError: (e: Error) => toast.error('Failed to clear chat', { description: e.message }),
  })

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || sendMut.isPending) return
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    sendMut.mutate({ message: msg, history })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col bg-white border-l border-[#d6e2ee]"
      >
        <SheetHeader className="px-4 py-3 border-b border-[#d6e2ee] bg-gradient-to-r from-[#071321] to-[#0c1a2c]">
          <SheetTitle className="flex items-center gap-2 text-white">
            <span className="size-7 rounded-lg bg-[#0084ff]/20 text-[#40d4ff] flex items-center justify-center">
              <MessageSquare className="size-4" />
            </span>
            True North Copilot
          </SheetTitle>
          <SheetDescription className="text-[#e2ebf5]/70">
            Field, sales, and estimating guidance grounded in Ohio roofing practice.
          </SheetDescription>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-3 right-10 text-[#e2ebf5]/70 hover:text-white hover:bg-white/10 h-7 px-2"
            onClick={() => setConfirmClear(true)}
            aria-label="Clear chat history"
          >
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-[#f5f8fc]">
          {messages.length === 0 && !typing && (
            <div className="text-center py-8">
              <div className="size-12 rounded-xl bg-[#0084ff]/10 text-[#0084ff] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6" />
              </div>
              <p className="text-sm font-semibold text-[#071321]">Ask True North Copilot</p>
              <p className="text-xs text-slate-500 mt-1 mb-4 max-w-[260px] mx-auto">
                Get guidance on the operating loop, IKO product selection, pricing, and job economics.
              </p>
              <div className="flex flex-col gap-1.5 items-center">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="w-[260px] text-left text-xs px-3 py-2 rounded-lg border border-[#d6e2ee] bg-white hover:border-[#0084ff] hover:bg-[#0084ff]/5 text-slate-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              leads={leadsQ.data?.leads || []}
              onNavigate={onNavigate}
              onOpenLead={onOpenLead}
            />
          ))}

          {typing && (
            <div className="flex items-center gap-2 text-slate-500 text-xs px-2">
              <Loader2 className="size-3.5 animate-spin text-[#0084ff]" />
              <span>Copilot is thinking…</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#d6e2ee] p-3 bg-white">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the loop, pricing, IKO…"
              disabled={sendMut.isPending}
              aria-label="Message True North Copilot"
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || sendMut.isPending}
              className="bg-[#0084ff] hover:bg-[#0070e0] text-white shrink-0"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 text-center">
            Press Enter to send · Copilot knows the True North operating loop
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all Copilot history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the conversation history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => clearMut.mutate()}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}

function MessageBubble({
  role,
  content,
  leads,
  onNavigate,
  onOpenLead,
}: {
  role: 'user' | 'assistant'
  content: string
  leads: Lead[]
  onNavigate?: (view: string) => void
  onOpenLead?: (leadId: string) => void
}) {
  const isUser = role === 'user'

  // Parse the assistant message for actionable references:
  // 1. Lead street addresses (matched to real leads by substring)
  // 2. View names (Command Center, Leads, Measure, Estimates, Jobs, Materials, Pricing)
  const actionChips: Array<{ type: 'lead' | 'view'; label: string; action: () => void; icon: LucideIcon }> = []

  if (!isUser && (onNavigate || onOpenLead)) {
    // Match lead streets — look for any lead street that appears in the content
    const lowerContent = content.toLowerCase()
    const seen = new Set<string>()
    for (const lead of leads) {
      if (lead.street && lowerContent.includes(lead.street.toLowerCase()) && !seen.has(lead.id)) {
        seen.add(lead.id)
        if (onOpenLead) {
          actionChips.push({
            type: 'lead',
            label: lead.street,
            action: () => onOpenLead(lead.id),
            icon: MapPin,
          })
        }
      }
    }
    // Match view names
    for (const view of VIEW_NAMES) {
      if (content.includes(view) && onNavigate) {
        // Map display names to ViewId
        const viewId = view === 'Command Center' ? 'dashboard'
          : view === 'Leads' ? 'leads'
          : view === 'Measure' ? 'measure'
          : view === 'Estimates' ? 'estimates'
          : view === 'Jobs' ? 'jobs'
          : view === 'Materials' ? 'materials'
          : view === 'Pricing' ? 'pricing'
          : null
        if (viewId && !actionChips.some(c => c.label === view)) {
          actionChips.push({
            type: 'view',
            label: view,
            action: () => onNavigate(viewId!),
            icon: ArrowUpRight,
          })
        }
      }
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-[#0084ff] text-white rounded-br-sm'
            : 'bg-white border border-[#d6e2ee] text-[#071321] rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap leading-relaxed">{content}</div>
        ) : (
          <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold text-[#071321]">{children}</strong>,
                code: ({ children }) => <code className="px-1 py-0.5 rounded bg-[#f5f8fc] text-[#0084ff] text-xs">{children}</code>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Action chips — clickable navigation to views/leads mentioned in the reply */}
        {actionChips.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#d6e2ee]/60 flex flex-wrap gap-1.5">
            {actionChips.map((chip, i) => {
              const Icon = chip.icon
              return (
                <button
                  key={`${chip.type}-${i}`}
                  type="button"
                  onClick={chip.action}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    chip.type === 'lead'
                      ? 'bg-[#0084ff]/10 text-[#0084ff] hover:bg-[#0084ff]/20 border border-[#0084ff]/20'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                  title={chip.type === 'lead' ? `Open ${chip.label} lead detail` : `Go to ${chip.label}`}
                >
                  <Icon className="size-2.5" />
                  {chip.label}
                  <ArrowUpRight className="size-2.5 opacity-60" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
