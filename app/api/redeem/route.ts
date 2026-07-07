import { NextResponse } from 'next/server'
import {
  interpretResponse,
  type RedemptionOutcome,
  type RedemptionResult,
} from '@/lib/redemption'
import {
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRedemptionSignature,
} from '@/lib/signing'

// Culver's Azure API Management mock endpoints.
const SUCCESS_URL =
  'https://test-api.culvers.com/punchh/Mock/checkoffsiteredeemable-success'
const FAIL_URL =
  'https://test-api.culvers.com/punchh/Mock/checkoffsiteredeemable-fail'

// The subscription key is the real trust anchor and stays server-side.
const SUBSCRIPTION_KEY = process.env.SUBSCRIPTION_KEY

/**
 * The provided endpoints are fixed success/fail mocks that ignore the code.
 * To exercise every real-world outcome from actual scanned codes, we route
 * test codes to the fail endpoint and derive the specific reason. A production
 * endpoint would instead accept the code and return its own status + reason,
 * which interpretResponse() already handles.
 */
function resolveMockOutcome(code: string): RedemptionOutcome {
  const c = code.toLowerCase()
  if (/^error\d+/.test(c) || c.includes('error')) return 'error'
  if (c.includes('expire') || c.includes('exp-')) return 'expired'
  if (/^used\d+/.test(c) || c.includes('used') || c.includes('redeem') || c.includes('dup'))
    return 'already_redeemed'
  if (/^invalid\d+/.test(c) || c.includes('invalid') || c.includes('fail') || c.includes('bad'))
    return 'invalid'
  return 'success'
}

async function callUpstream(
  url: string
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = { status: await res.text().catch(() => '') }
  }

  return { status: res.status, body }
}

export async function POST(request: Request) {
  let code = ''
  try {
    const payload = await request.json()
    code = typeof payload?.code === 'string' ? payload.code.trim() : ''
  } catch {
    return NextResponse.json(
      { outcome: 'error', code: '', title: 'Bad Request', detail: 'Malformed request body.' } satisfies RedemptionResult,
      { status: 400 }
    )
  }

  if (!code) {
    return NextResponse.json(
      { outcome: 'invalid', code: '', title: 'Invalid Code', detail: 'No redemption code was provided.' } satisfies RedemptionResult,
      { status: 400 }
    )
  }

  if (!SUBSCRIPTION_KEY) {
    return NextResponse.json(
      {
        outcome: 'error',
        code,
        title: 'Configuration Error',
        detail: 'The redemption service is not configured.',
      } satisfies RedemptionResult,
      { status: 500 }
    )
  }

  // Verify the client-generated signature before doing any work.
  const verification = await verifyRedemptionSignature({
    code,
    method: 'POST',
    path: '/api/redeem',
    timestamp: request.headers.get(TIMESTAMP_HEADER) ?? '',
    nonce: request.headers.get(NONCE_HEADER) ?? '',
    signature: request.headers.get(SIGNATURE_HEADER) ?? '',
  })

  if (!verification.ok) {
    return NextResponse.json(
      {
        outcome: 'error',
        code,
        title: 'Request Rejected',
        detail: `Signature check failed: ${verification.reason}.`,
      } satisfies RedemptionResult,
      { status: 401 }
    )
  }

  const desired = resolveMockOutcome(code)
  const url = desired === 'success' ? SUCCESS_URL : FAIL_URL

  try {
    const { status, body } = await callUpstream(url)

    // Merge the derived reason so interpretResponse can surface a specific
    // failure state from the generic mock payload.
    const enriched =
      desired === 'success'
        ? body
        : { ...(body as object), outcome: desired, reason: desired }

    const result = interpretResponse(code, status, enriched)
    const lowerCode = code.toLowerCase()

    const customDetail =
      /^error\d+/.test(lowerCode) || lowerCode.includes('error')
        ? 'An unknown error occurred reading the code, try scanning again.'
        : /^used\d+/.test(lowerCode) || lowerCode.includes('used') || lowerCode.includes('redeem') || lowerCode.includes('dup')
          ? 'This code has already been redeemed.'
          : /^invalid\d+/.test(lowerCode) || lowerCode.includes('invalid') || lowerCode.includes('fail') || lowerCode.includes('bad')
            ? 'This code was not recognized as valid.'
            : undefined

    return NextResponse.json(
      customDetail
        ? {
            ...result,
            detail: customDetail,
          }
        : result,
      { status: 200 }
    )
  } catch (err) {
    console.log('[v0] Upstream redemption call failed:', err)
    return NextResponse.json(
      {
        outcome: 'error',
        code,
        title: 'Service Unavailable',
        detail: 'Could not reach the redemption service. Please retry.',
      } satisfies RedemptionResult,
      { status: 502 }
    )
  }
}
