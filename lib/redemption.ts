// Shared domain types for the redemption flow. Used by both the client
// scanner and the server proxy so the contract stays in one place.

export type RedemptionOutcome =
  | 'success'
  | 'already_redeemed'
  | 'invalid'
  | 'expired'
  | 'error'

export interface RedemptionResult {
  outcome: RedemptionOutcome
  /** The redemption code that was scanned (echoed back for display). */
  code: string
  /** Human-readable headline shown to event staff. */
  title: string
  /** Supporting detail / failure reason shown under the headline. */
  detail: string
  /** Raw upstream payload, useful for debugging / audit. */
  raw?: unknown
}

interface OutcomeCopy {
  title: string
  detail: string
}

export const OUTCOME_COPY: Record<RedemptionOutcome, OutcomeCopy> = {
  success: {
    title: 'Code Redeemed',
    detail: 'Hand over the swag \u2014 this code is valid and now burned.',
  },
  already_redeemed: {
    title: 'Already Redeemed',
    detail: 'This code has already been used. Do not hand over swag.',
  },
  invalid: {
    title: 'Invalid Code',
    detail: 'This code was not recognized. Do not hand over swag.',
  },
  expired: {
    title: 'Code Expired',
    detail: 'This code is past its redemption window. Do not hand over swag.',
  },
  error: {
    title: 'Something Went Wrong',
    detail: 'We could not reach the redemption service. Try scanning again.',
  },
}

/**
 * Normalizes the code payload extracted from a QR image. Attendee QR codes may
 * contain a bare code, a URL with the code in a query param, or JSON. We try to
 * pull out the redemption code robustly.
 */
export function extractCode(rawPayload: string): string | null {
  const value = rawPayload?.trim()
  if (!value) return null

  // JSON payload: { "code": "ABC123" } or { "redemptionCode": "..." }
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value)
      const candidate =
        parsed.code ??
        parsed.redemptionCode ??
        parsed.redemption_code ??
        parsed.qr ??
        null
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    } catch {
      // fall through
    }
  }

  // URL payload: pull common code params, else use the last path segment.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const param =
        url.searchParams.get('code') ??
        url.searchParams.get('redemptionCode') ??
        url.searchParams.get('c')
      if (param && param.trim()) return param.trim()
      const segments = url.pathname.split('/').filter(Boolean)
      if (segments.length) return segments[segments.length - 1]
    } catch {
      // fall through
    }
  }

  return value
}

/**
 * Maps an upstream API response into a normalized RedemptionResult.
 * The provided mock returns { status: "itworked!!" } or
 * { status: "It Did Not Work!!" }. A real endpoint would return a richer
 * reason; this handles both shapes.
 */
export function interpretResponse(
  code: string,
  httpStatus: number,
  body: unknown
): RedemptionResult {
  const build = (outcome: RedemptionOutcome): RedemptionResult => ({
    outcome,
    code,
    title: OUTCOME_COPY[outcome].title,
    detail: OUTCOME_COPY[outcome].detail,
    raw: body,
  })

  if (httpStatus >= 500 || httpStatus === 0) return build('error')

  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  // Prefer an explicit reason if a real API provides one.
  const reason = String(
    record.reason ?? record.code ?? record.errorCode ?? ''
  ).toLowerCase()
  if (reason.includes('expire')) return build('expired')
  if (reason.includes('redeem') || reason.includes('used'))
    return build('already_redeemed')
  if (reason.includes('invalid') || reason.includes('not_found'))
    return build('invalid')

  const status = String(record.status ?? '').toLowerCase()
  const succeeded =
    record.success === true ||
    record.valid === true ||
    status.includes('itworked') ||
    status.includes('success')

  if (succeeded && httpStatus < 400) return build('success')

  // Fell through to a generic failure: use the derived outcome if present.
  const derived = String(record.outcome ?? '').toLowerCase()
  if (derived === 'expired') return build('expired')
  if (derived === 'already_redeemed') return build('already_redeemed')
  if (derived === 'invalid') return build('invalid')

  return build('invalid')
}
