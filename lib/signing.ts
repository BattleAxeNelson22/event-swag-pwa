// Client-side API request signing.
//
// Requirement: "Implement API request signing logic in the client."
//
// The scanned code is signed in the browser with an HMAC-SHA256 signature over a
// canonical string (method, path, timestamp, nonce, code). The signed request
// is sent to our own same-origin proxy (/api/redeem), which verifies the
// signature (rejecting stale/replayed requests) before attaching the vendor
// subscription key and forwarding to Culver's Azure API Management endpoint.
//
// Why a proxy instead of calling Culver's endpoint directly from the browser:
// the endpoint returns no Access-Control-Allow-Origin header, so a direct
// browser fetch is blocked by CORS. Routing through the proxy also keeps the
// vendor subscription key out of the shipped client bundle.
//
// Tradeoff: because this HMAC secret is shared with the browser, it is not a
// true secret. It exists to bind requests to this app and prevent trivial
// replay, not to fully authenticate an untrusted client. The real trust anchor
// (the subscription key) stays server-side.

export const SIGNATURE_HEADER = 'x-swag-signature'
export const TIMESTAMP_HEADER = 'x-swag-timestamp'
export const NONCE_HEADER = 'x-swag-nonce'

// Max clock skew allowed between client and server (ms).
export const SIGNATURE_TTL_MS = 60_000

// Shared HMAC secret. Public by nature of client-side signing.
export const SIGNING_SECRET =
  process.env.NEXT_PUBLIC_SIGNING_SECRET ?? 'swag-scanner-shared-signing-key'

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c?.subtle) {
    throw new Error('Web Crypto (crypto.subtle) is not available')
  }
  return c.subtle
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function canonicalString(params: {
  method: string
  path: string
  timestamp: string
  nonce: string
  code: string
}): string {
  const { method, path, timestamp, nonce, code } = params
  return [method.toUpperCase(), path, timestamp, nonce, code].join('\n')
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const subtle = getSubtle()
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(sig)
}

export interface SignedRequest {
  signature: string
  timestamp: string
  nonce: string
}

export async function signRedemption(
  code: string,
  opts: { method?: string; path?: string } = {}
): Promise<SignedRequest> {
  const method = opts.method ?? 'POST'
  const path = opts.path ?? '/api/redeem'
  const timestamp = Date.now().toString()
  const nonce =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)

  const signature = await hmacSha256Hex(
    SIGNING_SECRET,
    canonicalString({ method, path, timestamp, nonce, code })
  )

  return { signature, timestamp, nonce }
}

/** Constant-time-ish comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function verifyRedemptionSignature(params: {
  code: string
  method: string
  path: string
  timestamp: string
  nonce: string
  signature: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { code, method, path, timestamp, nonce, signature } = params

  if (!signature || !timestamp || !nonce) {
    return { ok: false, reason: 'missing signature headers' }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' }
  if (Math.abs(Date.now() - ts) > SIGNATURE_TTL_MS) {
    return { ok: false, reason: 'signature expired' }
  }

  const expected = await hmacSha256Hex(
    SIGNING_SECRET,
    canonicalString({ method, path, timestamp, nonce, code })
  )

  if (!safeEqual(expected, signature)) {
    return { ok: false, reason: 'signature mismatch' }
  }

  return { ok: true }
}
