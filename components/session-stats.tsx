'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SessionCounts {
  success: number
  failed: number
}

export interface RedemptionHistoryEntry {
  id: string
  code: string
  outcome: 'success' | 'already_redeemed' | 'invalid' | 'expired' | 'error'
  timestamp: string
  summary: string
  reason?: string
  prizeName?: string
}

export function SessionStats({
  counts,
  history,
}: {
  counts: SessionCounts
  history: RedemptionHistoryEntry[]
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-end gap-2"
      aria-label="Session totals"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full max-w-[220px] rounded-xl border border-white/10 bg-primary-foreground/10 px-2.5 py-2 text-left transition hover:bg-primary-foreground/20"
        aria-expanded={open}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Stat label="Redeemed" value={counts.success} tone="success" />
            <Stat label="Rejected" value={counts.failed} tone="failed" />
          </div>
          <div className="flex items-center justify-center gap-1 rounded-full bg-black/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/80">
            <span>History</span>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                open ? 'rotate-180' : ''
              )}
            />
          </div>
        </div>
      </button>

      {history.length > 0 && open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-slate-900/95 p-2.5 text-left shadow-2xl backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
              Last 5 results
            </p>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-primary-foreground/70 transition-transform',
                open ? 'rotate-180' : ''
              )}
            />
          </div>
          <ul className="space-y-1.5">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg bg-primary-foreground/10 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[10px] font-semibold text-white">
                    {entry.code}
                  </span>
                  <span
                    className={
                      entry.outcome === 'success'
                        ? 'text-[10px] font-semibold text-emerald-400'
                        : 'text-[10px] font-semibold text-rose-400'
                    }
                  >
                    {entry.outcome === 'success' ? 'Success' : 'Failed'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-white/90">
                  {formatHistoryTimestamp(entry.timestamp)}
                </p>
                <p
                  className={cn(
                    'text-[10px] leading-4',
                    entry.outcome === 'success'
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  )}
                >
                  {entry.outcome === 'success'
                    ? entry.prizeName
                      ? `Prize: ${entry.prizeName}`
                      : 'Prize recorded'
                    : `Reason: ${entry.reason ?? 'No reason provided'}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'failed'
}) {
  return (
    <div className="flex min-w-14 flex-col items-center rounded-lg bg-primary-foreground/10 px-2.5 py-1">
      <span
        className={
          tone === 'success'
            ? 'text-base font-bold leading-none text-success'
            : 'text-base font-bold leading-none text-primary-foreground'
        }
      >
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </span>
    </div>
  )
}

function formatHistoryTimestamp(timestamp: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return timestamp
  }
}
