'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  WifiOff,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RedemptionOutcome, RedemptionResult } from '@/lib/redemption'
import { cn } from '@/lib/utils'

const AUTO_ADVANCE_MS = 6000

interface OutcomeStyle {
  icon: LucideIcon
  panel: string
  iconWrap: string
}

const STYLES: Record<RedemptionOutcome, OutcomeStyle> = {
  success: {
    icon: CheckCircle2,
    panel: 'bg-[#eaf7ee] text-[#14532d]',
    iconWrap: 'bg-[#14532d]/12',
  },
  already_redeemed: {
    icon: XCircle,
    panel: 'bg-destructive text-white',
    iconWrap: 'bg-white/15',
  },
  invalid: {
    icon: AlertTriangle,
    panel: 'bg-destructive text-white',
    iconWrap: 'bg-white/15',
  },
  expired: {
    icon: Clock,
    panel: 'bg-destructive text-white',
    iconWrap: 'bg-white/15',
  },
  error: {
    icon: WifiOff,
    panel: 'bg-foreground text-background',
    iconWrap: 'bg-background/15',
  },
}

interface ResultCardProps {
  result: RedemptionResult
  onScanNext: () => void
  onRetry: () => void
}

export function ResultCard({ result, onScanNext, onRetry }: ResultCardProps) {
  const style = STYLES[result.outcome]
  const Icon = style.icon
  const isSuccess = result.outcome === 'success'
  const isError = result.outcome === 'error'
  const [remaining, setRemaining] = useState(AUTO_ADVANCE_MS)

  // Auto-advance after a valid scan so the line keeps moving. Failures stay up
  // until staff dismisses them so the reason is actually read.
  useEffect(() => {
    if (!isSuccess) return
    const started = Date.now()
    const tick = setInterval(() => {
      const left = AUTO_ADVANCE_MS - (Date.now() - started)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(tick)
        onScanNext()
      }
    }, 100)
    return () => clearInterval(tick)
  }, [isSuccess, onScanNext])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'scan-shell__panel flex h-full w-full flex-col items-center justify-between p-6 text-center animate-in fade-in zoom-in-95 duration-200',
        style.panel
      )}
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
        <div
          className={cn(
            'scan-shell__hero-icon h-28 w-28 rounded-full',
            style.iconWrap
          )}
        >
          <Icon className="h-16 w-16" strokeWidth={2.5} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance text-[#14532d]">
            {result.title}
          </h1>
          <p className="mx-auto max-w-xs text-base leading-relaxed text-[#166534] text-pretty">
            {result.detail}
          </p>
        </div>

        {result.code ? (
          <div className="rounded-xl border border-[#166534]/20 bg-[#14532d]/10 px-4 py-2 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#166534]/80">
              Redemption Code
            </p>
            <p className="mt-1 font-mono text-lg font-semibold break-all text-[#14532d]">
              {result.code}
            </p>
          </div>
        ) : null}
      </div>

      <div className="w-full space-y-3">
        {isError ? (
          <Button
            onClick={onRetry}
            size="lg"
            className="scan-shell__button-secondary h-14 bg-background text-lg font-semibold hover:bg-background/90"
          >
            <RotateCcw className="mr-2 h-5 w-5" aria-hidden="true" />
            Try Again
          </Button>
        ) : null}

        <Button
          onClick={onScanNext}
          size="lg"
          variant={isSuccess ? 'secondary' : 'default'}
          className={cn(
            'h-14 w-full text-lg font-semibold',
            isSuccess
              ? 'scan-shell__button-secondary bg-success-foreground text-success hover:bg-success-foreground/90'
              : 'scan-shell__button-primary bg-background text-foreground hover:bg-background/90'
          )}
        >
          {isSuccess
            ? `Scan Next (${Math.max(0, Math.ceil(remaining / 1000))})`
            : 'Scan Next'}
        </Button>
      </div>
    </div>
  )
}
