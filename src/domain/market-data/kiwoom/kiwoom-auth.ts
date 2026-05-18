/**
 * Kiwoom REST API OAuth token manager (au10001 / au10002).
 *
 * Tokens expire at `expires_dt` (YYYYMMDDHHMMSS KST).
 * This class fetches a new token automatically and caches it in memory
 * until 5 minutes before expiry — no persistent storage needed.
 */

const TOKEN_URL = 'https://api.kiwoom.com/oauth2/token'
const MOCK_TOKEN_URL = 'https://mockapi.kiwoom.com/oauth2/token'

export interface KiwoomTokenResponse {
  token: string
  token_type: string
  expires_dt: string // YYYYMMDDHHMMSS (KST)
}

export class KiwoomAuth {
  private appKey: string
  private secretKey: string
  private useMock: boolean

  private cachedToken: string | null = null
  private expiresAt: number = 0 // epoch ms

  constructor(appKey: string, secretKey: string, useMock = false) {
    this.appKey = appKey
    this.secretKey = secretKey
    this.useMock = useMock
  }

  /** Returns a valid Bearer token, refreshing if needed. */
  async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt) {
      return this.cachedToken
    }
    return this.refresh()
  }

  private async refresh(): Promise<string> {
    const url = this.useMock ? MOCK_TOKEN_URL : TOKEN_URL
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-id': 'au10001',
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.appKey,
        secretkey: this.secretKey,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Kiwoom token fetch failed: ${res.status} ${text}`)
    }

    const data = await res.json() as KiwoomTokenResponse
    this.cachedToken = data.token

    // expires_dt = YYYYMMDDHHMMSS (KST = UTC+9). Convert to epoch ms,
    // then subtract 5 min as a safety buffer.
    this.expiresAt = this.parseKstDatetime(data.expires_dt) - 5 * 60 * 1000

    return data.token
  }

  /** "20251231235959" → epoch ms (treating as KST = UTC+9) */
  private parseKstDatetime(dt: string): number {
    const y = dt.slice(0, 4)
    const mo = dt.slice(4, 6)
    const d = dt.slice(6, 8)
    const h = dt.slice(8, 10)
    const mi = dt.slice(10, 12)
    const s = dt.slice(12, 14)
    // KST is UTC+9; subtract 9 hours to get UTC
    const utcMs = Date.UTC(+y, +mo - 1, +d, +h - 9, +mi, +s)
    return utcMs
  }

  get configured(): boolean {
    return !!(this.appKey && this.secretKey)
  }
}
