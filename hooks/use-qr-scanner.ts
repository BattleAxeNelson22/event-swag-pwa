'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type QrScanner from 'qr-scanner'

export type ScannerError =
  | 'no-camera'
  | 'permission-denied'
  | 'insecure-context'
  | 'unknown'

interface UseQrScannerOptions {
  onDetect: (value: string) => void
  /** Throttle decoding to save battery/CPU under sustained use. */
  maxScansPerSecond?: number
}

interface UseQrScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: () => Promise<void>
  stop: () => void
  isRunning: boolean
  error: ScannerError | null
  hasFlash: boolean
  flashOn: boolean
  toggleFlash: () => Promise<void>
}

export function useQrScanner({
  onDetect,
  maxScansPerSecond = 8,
}: UseQrScannerOptions): UseQrScannerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const onDetectRef = useRef(onDetect)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<ScannerError | null>(null)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)

  // Keep the latest callback without restarting the camera.
  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  const stop = useCallback(() => {
    const scanner = scannerRef.current
    if (scanner) {
      scanner.stop()
    }
    setIsRunning(false)
    setFlashOn(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)

    if (typeof window === 'undefined') return
    if (!window.isSecureContext) {
      setError('insecure-context')
      return
    }

    const video = videoRef.current
    if (!video) return

    try {
      const QrScannerModule = (await import('qr-scanner')).default

      const hasCamera = await QrScannerModule.hasCamera()
      if (!hasCamera) {
        setError('no-camera')
        return
      }

      if (!scannerRef.current) {
        scannerRef.current = new QrScannerModule(
          video,
          (result) => {
            const value = result?.data?.trim()
            if (value) onDetectRef.current(value)
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond,
            returnDetailedScanResult: true,
          }
        )
      }

      await scannerRef.current.start()
      setIsRunning(true)

      const flashAvailable = await scannerRef.current.hasFlash().catch(() => false)
      setHasFlash(flashAvailable)
    } catch (err) {
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError('permission-denied')
      } else if (name === 'NotFoundError') {
        setError('no-camera')
      } else {
        console.log('[v0] Scanner start error:', err)
        setError('unknown')
      }
      setIsRunning(false)
    }
  }, [maxScansPerSecond])

  const toggleFlash = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      await scanner.toggleFlash()
      setFlashOn(scanner.isFlashOn())
    } catch (err) {
      console.log('[v0] Flash toggle failed:', err)
    }
  }, [])

  // Clean up the scanner + camera stream on unmount.
  useEffect(() => {
    return () => {
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [])

  return {
    videoRef,
    start,
    stop,
    isRunning,
    error,
    hasFlash,
    flashOn,
    toggleFlash,
  }
}
