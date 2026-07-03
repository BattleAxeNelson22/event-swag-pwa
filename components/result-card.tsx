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

const AUTO_ADVANCE_MS = 2600

interface OutcomeStyle {
  icon: LucideIcon
  panel: string
  iconWrap: string
}

const STYLES: Record<RedemptionOutcome, OutcomeStyle> = {
  success: {
    icon: CheckCircle2,
    panel: 'bg-success text-success-foreground',
    iconWrap: 'bg-success-foreground/15',
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
        'flex h-full w-full flex-col items-center justify-between p-6 text-center animate-in fade-in zoom-in-95 duration-200',
        style.panel
      )}
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
        <div
          className={cn(
            'flex h-28 w-28 items-center justify-center rounded-full',
            style.iconWrap
          )}
        >
          <Icon className="h-16 w-16" strokeWidth={2.5} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            {result.title}
          </h1>
          <p className="mx-auto max-w-xs text-base leading-relaxed opacity-90 text-pretty">
            {result.detail}
          </p>
        </div>

        {result.code ? (
          <div className="rounded-xl bg-black/10 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wider opacity-70">
              Redemption Code
            </p>
            <p className="font-mono text-lg font-semibold break-all">
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
            className="h-14 w-full bg-background text-foreground text-lg font-semibold hover:bg-background/90"
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
              ? 'bg-success-foreground text-success hover:bg-success-foreground/90'
              : 'bg-background text-foreground hover:bg-background/90'
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
