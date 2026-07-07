'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Keyboard,
  Loader2,
  ScanLine,
  Settings,
  Zap,
  ZapOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResultCard } from '@/components/result-card'
import {
  SessionStats,
  type RedemptionHistoryEntry,
  type SessionCounts,
} from '@/components/session-stats'
import { useQrScanner, type ScannerError } from '@/hooks/use-qr-scanner'
import { redeemCode } from '@/lib/redeem-client'
import { extractCode, type RedemptionResult } from '@/lib/redemption'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'scanning' | 'validating' | 'result'
type ThemeMode = 'light' | 'dark'

const HISTORY_STORAGE_KEY = 'swag-redemption-history-v1'
const SETTINGS_STORAGE_KEY = 'swag-scanner-settings-v1'

function triggerHapticFeedback(enabled: boolean) {
  if (typeof window === 'undefined' || !enabled) return
  if ('vibrate' in navigator) {
    navigator.vibrate?.(80)
  }
}

const ERROR_COPY: Record<ScannerError, { title: string; detail: string }> = {
  'no-camera': {
    title: 'No Camera Found',
    detail: 'This device has no usable camera. Use manual entry instead.',
  },
  'permission-denied': {
    title: 'Camera Access Needed',
    detail:
      'Allow camera access in your browser settings, then tap Start Scanning.',
  },
  'insecure-context': {
    title: 'Secure Connection Required',
    detail: 'Camera access requires HTTPS. Open this app over a secure link.',
  },
  unknown: {
    title: 'Camera Error',
    detail: 'The camera could not be started. Try again or use manual entry.',
  },
}

export function ScannerScreen() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [counts, setCounts] = useState<SessionCounts>({
    success: 0,
    failed: 0,
  })
  const [history, setHistory] = useState<RedemptionHistoryEntry[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [theme, setTheme] = useState<ThemeMode>('light')

  // Guards against processing multiple frames of the same code.
  const processingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY)
      if (!stored) return

      const parsed = JSON.parse(stored) as RedemptionHistoryEntry[]
      if (!Array.isArray(parsed)) return

      setHistory(parsed.slice(0, 5))
    } catch {
      // Ignore invalid persisted history and continue with an empty list.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as {
        hapticsEnabled?: boolean
        theme?: ThemeMode
      }
      if (typeof parsed.hapticsEnabled === 'boolean') {
        setHapticsEnabled(parsed.hapticsEnabled)
      }
      if (parsed.theme === 'dark' || parsed.theme === 'light') {
        setTheme(parsed.theme)
      }
    } catch {
      // Ignore invalid settings and keep defaults.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = window.document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ hapticsEnabled, theme })
    )
  }, [hapticsEnabled, theme])

  const validate = useCallback(async (rawValue: string) => {
    const code = extractCode(rawValue)
    if (!code) {
      processingRef.current = false
      return
    }

    setPhase('validating')
    const res = await redeemCode(code)
    if (res.outcome === 'success') {
      triggerHapticFeedback(hapticsEnabled)
    }

    setResult(res)
    setCounts((prev) => ({
      success: prev.success + (res.outcome === 'success' ? 1 : 0),
      failed:
        prev.failed +
        (res.outcome !== 'success' && res.outcome !== 'error' ? 1 : 0),
    }))

    const entry: RedemptionHistoryEntry = {
      id: `${Date.now()}-${code}`,
      code,
      outcome: res.outcome,
      timestamp: new Date().toISOString(),
      summary:
        res.outcome === 'success'
          ? res.prizeName
            ? `Success • ${res.prizeName}`
            : 'Success'
          : `Failure • ${res.detail || 'No reason provided'}`,
      reason: res.outcome === 'success' ? undefined : res.detail,
      prizeName: res.outcome === 'success' ? res.prizeName : undefined,
    }

    setHistory((prev) => [entry, ...prev].slice(0, 5))
    setPhase('result')
  }, [])

  const handleDetect = useCallback(
    (value: string) => {
      if (processingRef.current) return
      processingRef.current = true
      stop()
      void validate(value)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validate]
  )

  const { videoRef, start, stop, isRunning, error, hasFlash, flashOn, toggleFlash } =
    useQrScanner({ onDetect: handleDetect })

  const beginScanning = useCallback(async () => {
    processingRef.current = false
    setResult(null)
    setPhase('scanning')
    await start()
  }, [start])

  // If starting failed (permission/camera error), drop back to idle so the
  // error message and retry button are shown.
  useEffect(() => {
    if (phase === 'scanning' && error) {
      setPhase('idle')
    }
  }, [phase, error])

  const handleScanNext = useCallback(() => {
    void beginScanning()
  }, [beginScanning])

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const value = manualCode.trim()
      if (!value) return
      setManualOpen(false)
      setManualCode('')
      processingRef.current = true
      void validate(value)
    },
    [manualCode, validate]
  )

  return (
    <main className="scan-shell">
      {/* Header */}
      <header className="scan-shell__header z-20">
        <div className="scan-shell__brand">
          <div className="scan-shell__brand-icon">
            <ScanLine className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">Swag Redemption</p>
            <p className="text-xs opacity-80">Event Scanner</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full border border-border/60 bg-background/80 p-2 text-foreground shadow-sm"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
          <SessionStats counts={counts} history={history} />
        </div>
      </header>

      {/* Camera stage */}
      <div className="scan-shell__body">
        {/* Video is always mounted so the ref persists across phases. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            phase === 'scanning' || phase === 'validating'
              ? 'opacity-100'
              : 'opacity-0'
          )}
        />

        {/* Idle */}
        {phase === 'idle' ? (
          <div className="scan-shell__panel scan-shell__panel--idle px-6">
            {error ? (
              <IdleError
                title={ERROR_COPY[error].title}
                detail={ERROR_COPY[error].detail}
              />
            ) : (
              <>
                <div className="scan-shell__hero-icon bg-primary/90">
                  <Camera className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-balance">
                    Ready to Scan
                  </h1>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                    Point the camera at an attendee&apos;s QR code to validate and
                    redeem their swag.
                  </p>
                </div>
              </>
            )}

            <div className="w-full max-w-xs space-y-3">
              <Button
                onClick={beginScanning}
                size="lg"
                className="scan-shell__button-primary h-14 text-lg font-semibold"
              >
                <ScanLine className="mr-2 h-5 w-5" aria-hidden="true" />
                Start Scanning
              </Button>
              <Button
                onClick={() => setManualOpen(true)}
                variant="outline"
                size="lg"
                className="scan-shell__button-secondary h-12"
              >
                <Keyboard className="mr-2 h-5 w-5" aria-hidden="true" />
                Enter Code Manually
              </Button>
            </div>
          </div>
        ) : null}

        {/* Scanning overlay */}
        {phase === 'scanning' ? (
          <>
            <ScanReticle />
            <div className="absolute inset-x-0 top-4 z-10 flex justify-center px-4">
              <p className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white">
                Align the QR code within the frame
              </p>
            </div>
            <div className="scan-shell__action-bar">
              {hasFlash ? (
                <Button
                  onClick={toggleFlash}
                  variant="secondary"
                  size="lg"
                  className="scan-shell__action-button scan-shell__button-secondary h-12 gap-2 bg-white/90 hover:bg-white"
                >
                  {flashOn ? (
                    <ZapOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Zap className="h-5 w-5" aria-hidden="true" />
                  )}
                  {flashOn ? 'Flash Off' : 'Flash On'}
                </Button>
              ) : null}
              <Button
                onClick={() => setManualOpen(true)}
                variant="secondary"
                size="lg"
                className="scan-shell__action-button scan-shell__button-secondary h-12 gap-2 bg-white/90 hover:bg-white"
              >
                <Keyboard className="h-5 w-5" aria-hidden="true" />
                Manual
              </Button>
            </div>
          </>
        ) : null}

        {/* Validating overlay */}
        {phase === 'validating' ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/60 text-white">
            <Loader2 className="h-12 w-12 animate-spin" aria-hidden="true" />
            <p className="text-lg font-semibold">Validating code&hellip;</p>
          </div>
        ) : null}

        {/* Result overlay */}
        {phase === 'result' && result ? (
          <div className="absolute inset-0 z-10">
            <ResultCard
              result={result}
              onScanNext={handleScanNext}
              onRetry={() => {
                if (result.code) {
                  processingRef.current = true
                  void validate(result.code)
                } else {
                  handleScanNext()
                }
              }}
            />
          </div>
        ) : null}

        {/* Settings sheet */}
        {settingsOpen ? (
          <SettingsSheet
            hapticsEnabled={hapticsEnabled}
            onToggleHaptics={() => setHapticsEnabled((prev) => !prev)}
            theme={theme}
            onThemeChange={setTheme}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}

        {/* Manual entry sheet */}
        {manualOpen ? (
          <ManualEntry
            value={manualCode}
            onChange={setManualCode}
            onSubmit={handleManualSubmit}
            onClose={() => setManualOpen(false)}
          />
        ) : null}
      </div>
    </main>
  )
}

function IdleError({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
          {detail}
        </p>
      </div>
    </>
  )
}

function ScanReticle() {
  return (
    <div className="scan-shell__reticle pointer-events-none">
      <div className="absolute inset-0 bg-black/40" />
      <div className="scan-shell__reticle-window">
        <span className="scan-shell__reticle-corner scan-shell__reticle-corner--tl" />
        <span className="scan-shell__reticle-corner scan-shell__reticle-corner--tr" />
        <span className="scan-shell__reticle-corner scan-shell__reticle-corner--bl" />
        <span className="scan-shell__reticle-corner scan-shell__reticle-corner--br" />
        <div className="scan-shell__reticle-line animate-scan-line" />
      </div>
    </div>
  )
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <div className="scan-shell__sheet">
      <form
        onSubmit={onSubmit}
        className="w-full space-y-4 rounded-t-3xl bg-background p-6 animate-in slide-in-from-bottom duration-200"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-muted" />
        <div>
          <h2 className="text-lg font-bold">Enter Redemption Code</h2>
          <p className="text-sm text-muted-foreground">
            Use this if a QR code will not scan.
          </p>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. SWAG-2026-ABCDE"
          className="scan-shell__sheet-input h-14 w-full rounded-xl border border-input bg-card px-4 font-mono text-lg outline-none focus:ring-2 focus:ring-ring"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="scan-shell__button-secondary h-12 flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" className="scan-shell__button-primary h-12 flex-1" disabled={!value.trim()}>
            Validate
          </Button>
        </div>
      </form>
    </div>
  )
}
