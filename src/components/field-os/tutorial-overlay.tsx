'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TutorialStep {
  selector: string
  title: string
  text: string
}

interface TutorialOverlayProps {
  steps: TutorialStep[]
  open: boolean
  onClose: () => void
}

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8

export function TutorialOverlay({ steps, open, onClose }: TutorialOverlayProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number; placement: 'below' | 'above' } | null>(null)
  const [mounted, setMounted] = useState(false)

  // SSR-safe portal: only render after hydration so document.body exists.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const step = steps[stepIdx]

  const measure = useCallback(() => {
    if (!open || !step) {
      setTargetRect(null)
      setCardPos(null)
      return
    }
    const el = document.querySelector(step.selector) as HTMLElement | null
    if (!el) {
      setTargetRect(null)
      setCardPos(null)
      return
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // Wait a frame for scroll to settle
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const rect: Rect = {
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      }
      setTargetRect(rect)

      // Position the card below if there's room, else above
      const cardWidth = Math.min(360, window.innerWidth - 32)
      const cardHeight = 180 // estimate
      const below = rect.top + rect.height + 12 + cardHeight < window.innerHeight
      const placement: 'below' | 'above' = below ? 'below' : 'above'
      const top = placement === 'below'
        ? rect.top + rect.height + 12
        : Math.max(16, rect.top - cardHeight - 12)
      // Center horizontally on the target, clamped to viewport
      let left = rect.left + rect.width / 2 - cardWidth / 2
      left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left))
      setCardPos({ top, left, placement })
    })
  }, [open, step])

  // Reset to first step whenever the overlay is (re)opened.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) setStepIdx(0)
  }, [open])

  // Measure the spotlight target on open / step change / viewport changes.
  // This genuinely needs to read layout from the DOM and write it back to state.
  useEffect(() => {
    if (!open) return
    measure()
    const onResize = () => measure()
    const onScroll = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    const t = window.setTimeout(measure, 100) // re-measure after scroll-in
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      window.clearTimeout(t)
    }
  }, [open, stepIdx, measure])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!mounted || !open || !step) return null

  const isLast = stepIdx === steps.length - 1

  // Clip-path approach: punch a rounded hole out of the overlay
  const clipPath = targetRect
    ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.left + targetRect.width}px ${targetRect.top}px, ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px, ${targetRect.left}px ${targetRect.top + targetRect.height}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
    : undefined

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Tutorial overlay">
      {/* Dimmed overlay with hole cut out */}
      <div
        className="absolute inset-0 bg-[#071321]/75 backdrop-blur-[2px]"
        style={clipPath ? { clipPath } : undefined}
      />

      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className="absolute rounded-md ring-2 ring-[#40d4ff] ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-150"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 0 9999px rgba(7,19,33,0.001)',
          }}
        />
      )}

      {/* Click-catcher (Skip on outside click) */}
      <button
        type="button"
        aria-label="Skip tutorial"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      {/* Tutorial card */}
      {cardPos && (
        <div
          className="absolute z-[101] w-[min(360px,calc(100vw-32px))] bg-white rounded-xl shadow-2xl border border-[#d6e2ee] overflow-hidden pointer-events-auto"
          style={{ top: cardPos.top, left: cardPos.left }}
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-[#071321] to-[#0c1a2c] px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-6 rounded-full bg-[#0084ff] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {stepIdx + 1}
              </span>
              <span className="text-white text-xs font-semibold uppercase tracking-wide truncate">
                {step.title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tutorial"
              className="text-[#e2ebf5]/70 hover:text-white shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-3">
            <p className="text-sm text-slate-700 leading-relaxed">{step.text}</p>

            {/* Progress dots */}
            <div className="flex items-center gap-1 mt-3">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIdx ? 'w-6 bg-[#0084ff]' : i < stepIdx ? 'w-1.5 bg-[#0084ff]/50' : 'w-1.5 bg-slate-300'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] text-slate-400">
                Step {stepIdx + 1} of {steps.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Skip
                </Button>
                {isLast ? (
                  <Button
                    size="sm"
                    className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
                    onClick={onClose}
                  >
                    <Check className="size-3.5" /> Done
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="bg-[#0084ff] hover:bg-[#0070e0] text-white"
                    onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
                  >
                    Next <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
