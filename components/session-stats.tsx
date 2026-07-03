'use client'

export interface SessionCounts {
  success: number
  failed: number
}

export function SessionStats({ counts }: { counts: SessionCounts }) {
  return (
    <div className="flex items-center gap-2" aria-label="Session totals">
      <Stat label="Redeemed" value={counts.success} tone="success" />
      <Stat label="Rejected" value={counts.failed} tone="failed" />
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
