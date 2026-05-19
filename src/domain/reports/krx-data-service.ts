/**
 * KrxDataService — collects Korean-market-specific data for report generation.
 * Wraps Kiwoom API calls with graceful fallbacks.
 */

import type {
  KiwoomClient,
  ForeignFlowRow,
  InstitTrendRow,
  ThemeGroup,
  StockBasicInfo,
  ShortSellingRow,
  CreditTrendRow,
  ExecutionStrengthDailyRow,
  InvestorDetailRow,
} from '../market-data/kiwoom/kiwoom-client.js'

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
  /** Stock basic info: PER/EPS/ROE/PBR/시가총액/신용비율/외인소진률 (ka10001). */
  basicInfo: StockBasicInfo | null
  /** Short selling trend — last 20 days (ka10014). */
  shortSelling: ShortSellingRow[]
  /** Credit (margin) trading trend — last 20 days (ka10013). */
  creditTrend: CreditTrendRow[]
  /** Daily execution strength — last 20 days (ka10047). */
  execStrength: ExecutionStrengthDailyRow[]
  /** Per-investor-type net buy breakdown — last 20 days (ka10059). */
  investorDetail: InvestorDetailRow[]
}

/** Format a Date as YYYYMMDD in KST (UTC+9). Using UTC here gives the wrong date between 15:00–24:00 UTC. */
function kstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10).replace(/-/g, '')
}

function nDaysAgo(n: number): string {
  return kstDateString(new Date(Date.now() - n * 24 * 60 * 60 * 1000))
}

function today(): string {
  return kstDateString(new Date())
}

/** Strip .KS / .KQ suffix to get the bare 6-digit code. */
function stripSuffix(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/i, '')
}

export class KrxDataService {
  constructor(private client: KiwoomClient) {}

  async fetch(symbol: string): Promise<KrxFlowData> {
    const stkCd = stripSuffix(symbol)
    const todayStr = today()
    const ago30 = nDaysAgo(30)
    const ago20 = nDaysAgo(20)

    const [
      foreignFlow,
      institResult,
      themes,
      basicInfo,
      shortSelling,
      creditTrend,
      execStrength,
      investorDetail,
    ] = await Promise.allSettled([
      this.client.getForeignFlow(stkCd),
      this.client.getInstitTrend(stkCd, ago30, todayStr),
      this.client.getThemesByStock(stkCd),
      this.client.getStockBasicInfo(stkCd),
      this.client.getShortSelling(stkCd, ago20, todayStr),
      this.client.getCreditTrend(stkCd, todayStr, '1'),
      this.client.getExecutionStrengthDaily(stkCd),
      this.client.getInvestorDetail(stkCd, todayStr, '1', '0'),
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
      basicInfo: basicInfo.status === 'fulfilled' ? basicInfo.value : null,
      shortSelling: (shortSelling.status === 'fulfilled' ? shortSelling.value : []).slice(0, 20),
      creditTrend: (creditTrend.status === 'fulfilled' ? creditTrend.value : []).slice(0, 20),
      execStrength: (execStrength.status === 'fulfilled' ? execStrength.value : []).slice(0, 20),
      investorDetail: (investorDetail.status === 'fulfilled' ? investorDetail.value : []).slice(0, 20),
    }
  }
}
