/**
 * KrxDataService — collects Korean-market-specific data for report generation.
 * Wraps Kiwoom API calls with graceful fallbacks.
 */

import type { KiwoomClient, ForeignFlowRow, InstitTrendRow, ThemeGroup } from '../market-data/kiwoom/kiwoom-client.js'

export interface KrxFlowData {
  /** Latest foreign investor snapshot (most recent row from ka10008). */
  foreignLatest: ForeignFlowRow | null
  /** Last 30 days institutional + foreign trend (ka10045). */
  institTrend: {
    rows: InstitTrendRow[]
    orgnAvg: string
    forAvg: string
  }
  /** Theme groups the stock belongs to (ka90001 stock-mode). */
  themes: ThemeGroup[]
}

function nDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

/** Strip .KS / .KQ suffix to get the bare 6-digit code. */
function stripSuffix(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/i, '')
}

export class KrxDataService {
  constructor(private client: KiwoomClient) {}

  async fetch(symbol: string): Promise<KrxFlowData> {
    const stkCd = stripSuffix(symbol)

    const [foreignFlow, institResult, themes] = await Promise.allSettled([
      this.client.getForeignFlow(stkCd),
      this.client.getInstitTrend(stkCd, nDaysAgo(30), today()),
      this.client.getThemesByStock(stkCd),
    ])

    const foreignRows = foreignFlow.status === 'fulfilled' ? foreignFlow.value : []
    const foreignLatest = foreignRows.length > 0 ? foreignRows[0] : null

    const institData = institResult.status === 'fulfilled'
      ? institResult.value
      : { rows: [], orgnAvg: '', forAvg: '' }

    const themeList = themes.status === 'fulfilled' ? themes.value : []

    return {
      foreignLatest,
      institTrend: institData,
      themes: themeList.slice(0, 5),
    }
  }
}
