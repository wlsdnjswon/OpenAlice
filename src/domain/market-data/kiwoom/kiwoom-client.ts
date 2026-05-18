/**
 * Kiwoom REST API client.
 * Handles token injection, pagination (cont-yn / next-key headers),
 * and wraps the KRX-specific endpoints used by OpenAlice.
 *
 * All methods return empty arrays / objects gracefully when the API
 * is unreachable or credentials are missing.
 */

import type { KiwoomAuth } from './kiwoom-auth.js'

const BASE_URL = 'https://api.kiwoom.com'
const MAX_PAGES = 10 // safety cap for paginated calls

// ─── Low-level request helper ────────────────────────────────────────────────

interface KiwoomResponse<T> {
  data: T
  contYn: string
  nextKey: string
  returnCode?: number
  returnMsg?: string
}

async function callKiwoom<T>(
  auth: KiwoomAuth,
  apiId: string,
  urlPath: string,
  body: Record<string, unknown>,
  contYn = 'N',
  nextKey = '',
): Promise<KiwoomResponse<T>> {
  const token = await auth.getToken()
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: 'POST',
    headers: {
      'api-id': apiId,
      'authorization': `Bearer ${token}`,
      'cont-yn': contYn,
      'next-key': nextKey,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Kiwoom ${apiId} failed: ${res.status} ${text}`)
  }

  const data = await res.json() as T & { return_code?: number; return_msg?: string }
  return {
    data,
    contYn: res.headers.get('cont-yn') ?? 'N',
    nextKey: res.headers.get('next-key') ?? '',
    returnCode: data.return_code,
    returnMsg: data.return_msg,
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KrxStockEntry {
  code: string       // 6-digit code
  name: string
  listCount: string
  auditInfo: string
  regDay: string
  lastPrice: string
  state: string
  marketCode: string
  marketName: string // "코스피" | "코스닥"
  upName: string     // sector
  upSizeName: string
}

export interface ForeignFlowRow {
  dt: string          // YYYYMMDD
  close_pric: string
  pred_pre: string    // 전일대비
  trde_qty: string
  chg_qty: string     // 변동수량
  poss_stkcnt: string // 보유주식수
  wght: string        // 비중 %
  gain_pos_stkcnt: string
  frgnr_limit: string
  frgnr_limit_irds: string
  limit_exh_rt: string // 한도소진율
}

export interface InstitTrendRow {
  dt: string
  close_pric: string
  pre_sig: string
  pred_pre: string
  flu_rt: string             // 등락율
  trde_qty: string
  orgn_dt_acc: string        // 기관기간누적
  orgn_daly_nettrde_qty: string // 기관일별순매매수량
  for_dt_acc: string         // 외인기간누적
  for_daly_nettrde_qty: string  // 외인일별순매매수량
  limit_exh_rt: string       // 한도소진율
}

export interface ThemeGroup {
  thema_grp_cd: string
  thema_nm: string
  stk_num: string
  flu_sig: string
  flu_rt?: string
  dt_prft_rt?: string
}

// ─── KiwoomClient ─────────────────────────────────────────────────────────────

export class KiwoomClient {
  constructor(private auth: KiwoomAuth) {}

  /**
   * ka10099 — fetch full stock list for a market.
   * mrkt_tp: "0" = KOSPI, "10" = KOSDAQ
   * Paginates automatically; returns all entries.
   */
  async getStockList(mrktTp: '0' | '10'): Promise<KrxStockEntry[]> {
    const entries: KrxStockEntry[] = []
    let contYn = 'N'
    let nextKey = ''

    for (let page = 0; page < MAX_PAGES; page++) {
      const r = await callKiwoom<{ list?: KrxStockEntry[] }>(
        this.auth, 'ka10099', '/api/dostk/stkinfo',
        { mrkt_tp: mrktTp },
        contYn, nextKey,
      )
      const batch = r.data.list ?? []
      entries.push(...batch)
      if (r.contYn !== 'Y' || !r.nextKey) break
      contYn = 'Y'
      nextKey = r.nextKey
    }
    return entries
  }

  /**
   * ka10008 — 주식외국인종목별매매동향.
   * stk_cd: 6-digit code (e.g. "005930")
   */
  async getForeignFlow(stkCd: string): Promise<ForeignFlowRow[]> {
    const r = await callKiwoom<{ stk_frgnr?: ForeignFlowRow[] }>(
      this.auth, 'ka10008', '/api/dostk/frgnistt',
      { stk_cd: stkCd },
    )
    return r.data.stk_frgnr ?? []
  }

  /**
   * ka10045 — 종목별기관매매추이요청.
   * Returns per-day institutional + foreign combined trend.
   */
  async getInstitTrend(
    stkCd: string,
    strtDt: string, // YYYYMMDD
    endDt: string,  // YYYYMMDD
  ): Promise<{ rows: InstitTrendRow[]; orgnAvg: string; forAvg: string }> {
    const r = await callKiwoom<{
      orgn_prsm_avg_pric?: string
      for_prsm_avg_pric?: string
      stk_orgn_trde_trnsn?: InstitTrendRow[]
    }>(
      this.auth, 'ka10045', '/api/dostk/mrkcond',
      { stk_cd: stkCd, strt_dt: strtDt, end_dt: endDt, orgn_prsm_unp_tp: '1', for_prsm_unp_tp: '1' },
    )
    return {
      rows: r.data.stk_orgn_trde_trnsn ?? [],
      orgnAvg: r.data.orgn_prsm_avg_pric ?? '',
      forAvg: r.data.for_prsm_avg_pric ?? '',
    }
  }

  /**
   * ka90001 — 테마그룹별요청 (stock search mode).
   * Finds theme groups that contain the given stock code.
   */
  async getThemesByStock(stkCd: string): Promise<ThemeGroup[]> {
    const r = await callKiwoom<{ thema_grp?: ThemeGroup[] }>(
      this.auth, 'ka90001', '/api/dostk/thme',
      { qry_tp: '2', stk_cd: stkCd, date_tp: '20', flu_pl_amt_tp: '1', stex_tp: '1' },
    )
    return r.data.thema_grp ?? []
  }
}
