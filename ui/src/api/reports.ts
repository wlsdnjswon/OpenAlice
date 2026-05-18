import { fetchJson } from './client'

export type ReportType = 'short' | 'long'
export type ReportStatus = 'generating' | 'done' | 'error'
export type ReportAssetClass = 'equity' | 'crypto' | 'currency' | 'commodity'

export interface ReportIndex {
  id: string
  symbol: string
  assetClass: ReportAssetClass
  type: ReportType
  status: ReportStatus
  createdAt: string
  completedAt?: string
  language: 'ko' | 'en'
  title: string
  errorMessage?: string
}

export interface ReportDetail extends ReportIndex {
  dataSnapshot: object
  content: string
  generationMs: number
}

export interface ReportListResponse {
  reports: ReportIndex[]
  count: number
}

export type GenerateSSEEvent =
  | { type: 'progress'; step: string; message: string }
  | { type: 'done'; report: ReportIndex }
  | { type: 'error'; message: string }

export interface KrxFlowRow {
  dt: string
  close_pric: string
  orgn_dt_acc: string
  orgn_daly_nettrde_qty: string
  for_dt_acc: string
  for_daly_nettrde_qty: string
  limit_exh_rt: string
  flu_rt: string
}

export interface KrxForeignLatest {
  dt: string
  wght: string
  limit_exh_rt: string
  chg_qty: string
  poss_stkcnt: string
}

export interface KrxTheme {
  thema_grp_cd: string
  thema_nm: string
  stk_num: string
}

export interface KrxFlowData {
  foreignLatest: KrxForeignLatest | null
  institTrend: { rows: KrxFlowRow[]; orgnAvg: string; forAvg: string }
  themes: KrxTheme[]
}

export const reportsApi = {
  async list(params?: { symbol?: string; type?: ReportType; assetClass?: ReportAssetClass; limit?: number }): Promise<ReportListResponse> {
    const qs = new URLSearchParams()
    if (params?.symbol) qs.set('symbol', params.symbol)
    if (params?.type) qs.set('type', params.type)
    if (params?.assetClass) qs.set('assetClass', params.assetClass)
    if (params?.limit) qs.set('limit', String(params.limit))
    return fetchJson(`/api/reports?${qs}`)
  },

  async get(id: string): Promise<ReportDetail> {
    return fetchJson(`/api/reports/${id}`)
  },

  async delete(id: string): Promise<void> {
    await fetchJson(`/api/reports/${id}`, { method: 'DELETE' })
  },

  /**
   * Stream report generation events via SSE.
   * Calls onEvent for each progress/done/error event.
   * Returns the final ReportIndex on success, throws on error.
   */
  async generate(
    params: { symbol: string; assetClass: ReportAssetClass; type: ReportType; language: 'ko' | 'en' },
    onEvent: (event: GenerateSSEEvent) => void,
  ): Promise<ReportIndex> {
    const res = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
      throw new Error(err.error || res.statusText)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw) as GenerateSSEEvent
          onEvent(event)
          if (event.type === 'done') return event.report
          if (event.type === 'error') throw new Error(event.message)
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    throw new Error('Stream ended without completion')
  },

  /** KRX-enhanced analysis (한국 특화 분석). */
  async generateKrx(
    params: { symbol: string; type: ReportType; language: 'ko' | 'en' },
    onEvent: (event: GenerateSSEEvent) => void,
  ): Promise<ReportIndex> {
    const res = await fetch('/api/reports/generate-krx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
      throw new Error(err.error || res.statusText)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (!raw) continue
        try {
          const event = JSON.parse(raw) as GenerateSSEEvent
          onEvent(event)
          if (event.type === 'done') return event.report
          if (event.type === 'error') throw new Error(event.message)
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }

    throw new Error('Stream ended without completion')
  },
}
