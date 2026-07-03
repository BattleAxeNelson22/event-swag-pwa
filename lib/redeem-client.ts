'use client'

import type { RedemptionResult } from '@/lib/redemption'
import {
  NONCE_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signRedemption,
} from '@/lib/signing'

/**
 * Signs the scanned code in the browser and sends it to the same-origin proxy,
 * which verifies the signature and forwards to Culver's endpoint.
 */
export async function redeemCode(code: string): Promise<RedemptionResult> {
  try {
    const signed = await signRedemption(code, {
      method: 'POST',
      path: '/api/redeem',
    })

    const res = await fetch('/api/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SIGNATURE_HEADER]: signed.signature,
        [TIMESTAMP_HEADER]: signed.timestamp,
        [NONCE_HEADER]: signed.nonce,
      },
      body: JSON.stringify({ code }),
    })

    const data = (await res.json()) as RedemptionResult
    return data
  } catch (err) {
    console.log('[v0] redeemCode failed:', err)
    return {
      outcome: 'error',
      code,
      title: 'Connection Problem',
      detail: 'Could not complete the redemption. Check your connection and retry.',
    }
  }
}
