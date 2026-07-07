'use client'

import { useState } from 'react'
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

  return (
    <div className="relative flex flex-col items-end gap-2" aria-label="Session totals">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg bg-primary-foreground/10 px-2.5 py-1 transition hover:bg-primary-foreground/20"
          aria-expanded={open}
        >
          <Stat label="Redeemed" value={counts.success} tone="success" />
        </button>
        <Stat label="Rejected" value={counts.failed} tone="failed" />
      </div>

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
                  <span className="truncate font-mono text-[10px] font-semibold">
                    {entry.code}
                  </span>
                  <span
                    className={
                      entry.outcome === 'success'
                        ? 'text-[10px] font-semibold text-accent'
                        : 'text-[10px] font-semibold text-primary-foreground'
                    }
                  >
                    {entry.outcome === 'success' ? 'Success' : 'Failed'}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-primary-foreground/80">
                  {formatHistoryTimestamp(entry.timestamp)}
                </p>
                <p className="text-[10px] leading-4 text-primary-foreground/80">
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
            ? 'text-base font-bold leading-none text-accent'
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
