/**
 * KiwoomRestClient — OAuth2 token management + typed REST calls.
 *
 * All Kiwoom REST endpoints are POST. The api-id header is the TR code that
 * distinguishes different operations (same URL, different api-id).
 *
 * Token lifecycle: obtained via client_credentials grant, valid 24 hours.
 * Refreshed automatically 60s before expiry.
 */

import { BrokerError } from '../types.js'
import type {
  KiwoomBrokerConfig,
  KiwoomTokenResponse,
  KiwoomBaseResponse,
} from './kiwoom-types.js'

const LIVE_BASE  = 'https://api.kiwoom.com'
const MOCK_BASE  = 'https://mockapi.kiwoom.com'
const TOKEN_PATH = '/oauth2/token'
const REVOKE_PATH = '/oauth2/revoke'

export class KiwoomRestClient {
  private readonly baseUrl: string
  private readonly appkey: string
  private readonly secretkey: string

  private token: string | null = null
  private tokenExpiry = 0   // ms epoch

  constructor(cfg: KiwoomBrokerConfig) {
    this.baseUrl   = cfg.paper ? MOCK_BASE : LIVE_BASE
    this.appkey    = cfg.appkey
    this.secretkey = cfg.secretkey
  }

  // ==================== Token management ====================

  async ensureToken(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiry - 60_000) return
    await this.fetchToken()
  }

  private async fetchToken(): Promise<void> {
    const res = await fetch(`${this.baseUrl}${TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json;charset=UTF-8' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: this.appkey,
        secretkey: this.secretkey,
      }),
    })
    if (!res.ok) {
      throw new BrokerError('AUTH', `Kiwoom token request failed: HTTP ${res.status}`)
    }
    const body = await res.json() as KiwoomTokenResponse
    if (body.return_code !== 0) {
      throw new BrokerError('AUTH', `Kiwoom token error: ${body.return_msg}`)
    }
    this.token = body.token
    // expires_dt: "20241107083713" (KST, YYYYMMDDHHmmss)
    this.tokenExpiry = parseKiwoomDate(body.expires_dt).getTime()
  }

  async revokeToken(): Promise<void> {
    if (!this.token) return
    try {
      await fetch(`${this.baseUrl}${REVOKE_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
          'api-id': 'au10002',
          'authorization': `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          appkey: this.appkey,
          secretkey: this.secretkey,
          token: this.token,
        }),
      })
    } catch {
      // best-effort revocation; ignore errors
    }
    this.token = null
    this.tokenExpiry = 0
  }

  // ==================== Generic request ====================

  /**
   * POST to url with api-id header.
   * Handles pagination automatically when `contYn` / `nextKey` are needed
   * (pass `collectPages: true` to accumulate multiple list responses).
   */
  async post<T extends KiwoomBaseResponse>(
    apiId: string,
    urlPath: string,
    body: object,
    contYn?: string,
    nextKey?: string,
  ): Promise<T> {
    await this.ensureToken()

    const headers: Record<string, string> = {
      'api-id': apiId,
      'authorization': `Bearer ${this.token!}`,
      'content-type': 'application/json;charset=UTF-8',
    }
    if (contYn) headers['cont-yn'] = contYn
    if (nextKey) headers['next-key'] = nextKey

    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      if (res.status === 401) throw new BrokerError('AUTH', `Kiwoom 401: ${text}`)
      if (res.status === 429) throw new BrokerError('NETWORK', `Kiwoom rate limit (429)`)
      if (res.status >= 500) throw new BrokerError('NETWORK', `Kiwoom server error ${res.status}`)
      throw new BrokerError('EXCHANGE', `Kiwoom HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json() as T
    if (data.return_code !== 0) {
      throw new BrokerError('EXCHANGE', `Kiwoom API error [${apiId}]: ${data.return_msg}`)
    }
    return data
  }

  /**
   * POST with automatic pagination — collects all pages of a list field.
   * `listField` is the key in the response that holds the array.
   */
  async postPaged<T extends KiwoomBaseResponse & Record<string, unknown>>(
    apiId: string,
    urlPath: string,
    body: object,
    listField: string,
  ): Promise<T> {
    let contYn: string | undefined
    let nextKey: string | undefined
    let accumulated: unknown[] = []
    let lastResponse!: T

    do {
      lastResponse = await this.post<T>(apiId, urlPath, body, contYn, nextKey)
      const page = (lastResponse[listField] as unknown[]) ?? []
      accumulated = accumulated.concat(page)
      // Check pagination headers from response body
      contYn = (lastResponse as Record<string, string>)['cont_yn'] as string | undefined
      nextKey = (lastResponse as Record<string, string>)['next_key'] as string | undefined
    } while (contYn === 'Y' && nextKey)

    return { ...lastResponse, [listField]: accumulated }
  }

  get wsBaseUrl(): string {
    return this.baseUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
      + ':10000'
  }

  /** Current bearer token — used by WS client for handshake */
  async getToken(): Promise<string> {
    await this.ensureToken()
    return this.token!
  }
}

// ==================== Helpers ====================

/**
 * Parse Kiwoom date string "20241107083713" (KST, UTC+9) → Date (UTC).
 */
export function parseKiwoomDate(dt: string): Date {
  // "20241107083713" → year=2024, month=11, day=07, h=08, m=37, s=13
  const year  = parseInt(dt.slice(0, 4), 10)
  const month = parseInt(dt.slice(4, 6), 10) - 1
  const day   = parseInt(dt.slice(6, 8), 10)
  const hour  = parseInt(dt.slice(8, 10), 10)
  const min   = parseInt(dt.slice(10, 12), 10)
  const sec   = parseInt(dt.slice(12, 14), 10)
  // KST = UTC+9, subtract 9h to get UTC
  return new Date(Date.UTC(year, month, day, hour - 9, min, sec))
}
