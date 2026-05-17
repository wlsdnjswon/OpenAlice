import { randomUUID } from 'node:crypto'
import type { EquityClientLike, CryptoClientLike, CommodityClientLike } from '../market-data/client/types.js'
import type { INewsProvider } from '../news/types.js'
import type { AgentCenter } from '../../core/agent-center.js'
import type { ReportIndex, ReportDetail, ReportType, ReportAssetClass } from './types.js'
import { ReportStore } from './store.js'
import { calcRSI, calcMACD, calcBB, calcVolumeRatio } from './indicators.js'
import {
  buildShortEquityPrompt,
  buildLongEquityPrompt,
  buildCryptoPrompt,
  buildGenericPrompt,
} from './prompts.js'

export type ProgressCallback = (step: string, message: string) => Promise<void> | void

export interface ReportServiceDeps {
  equityClient: EquityClientLike
  cryptoClient: CryptoClientLike
  commodityClient: CommodityClientLike
  newsProvider: INewsProvider
  agentCenter: AgentCenter
}

export class ReportService {
  readonly store: ReportStore
  private deps: ReportServiceDeps

  constructor(deps: ReportServiceDeps) {
    this.deps = deps
    this.store = new ReportStore()
  }

  async init(): Promise<void> {
    await this.store.init()
  }

  private nDaysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  /**
   * KRX stocks (.KS / .KQ) have limited FMP coverage on free plans:
   * - key-metrics returns 0 rows
   * - price-target-consensus throws 402 (premium endpoint)
   * - insider-trading has no data
   * Use yfinance for these symbols to avoid noisy 402 errors and empty sections.
   */
  private equityProvider(symbol: string): string {
    return symbol.endsWith('.KS') || symbol.endsWith('.KQ') ? 'yfinance' : 'fmp'
  }

  private buildTitle(symbol: string, type: ReportType, lang: 'ko' | 'en'): string {
    const date = new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
    if (lang === 'ko') {
      return `${symbol} ${type === 'short' ? '단기' : '장기'} 투자 분석 보고서 (${date})`
    }
    return `${symbol} ${type === 'short' ? 'Short-Term' : 'Long-Term'} Investment Report (${date})`
  }

  async generate(
    symbol: string,
    assetClass: ReportAssetClass,
    type: ReportType,
    language: 'ko' | 'en',
    onProgress: ProgressCallback,
  ): Promise<ReportDetail> {
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    const title = this.buildTitle(symbol, type, language)

    const indexEntry: ReportIndex = {
      id, symbol, assetClass, type, status: 'generating', createdAt, language, title,
    }
    await this.store.append(indexEntry)

    const startMs = Date.now()
    const { equityClient, cryptoClient, newsProvider, agentCenter } = this.deps
    const t = (ko: string, en: string) => language === 'ko' ? ko : en

    let dataSnapshot: object
    let prompt: string

    try {
      if (assetClass === 'equity') {
        const ep = this.equityProvider(symbol)
        if (type === 'short') {
          await onProgress('data', t('시장 데이터 수집 중...', 'Collecting market data...'))
          const [historical, profileArr, news] = await Promise.all([
            equityClient.getHistorical({ symbol, start_date: this.nDaysAgo(90), interval: '1d' }).catch(() => []),
            equityClient.getProfile({ symbol, provider: ep }).catch(() =>
              equityClient.getProfile({ symbol, provider: 'yfinance' }).catch(() => [])),
            newsProvider.getNewsV2({ endTime: new Date(), lookback: '1d', limit: 12 }).catch(() => []),
          ])

          await onProgress('indicators', t('기술적 지표 계산 중...', 'Calculating indicators...'))
          const bars = (historical as Array<Record<string, unknown>>)
            .filter((d) => d.close != null)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          const closes = bars.map((d) => Number(d.close))
          const volumes = bars.map((d) => Number(d.volume ?? 0))
          const lastClose = closes.at(-1) ?? 0
          const prevClose = closes.at(-2) ?? lastClose
          const change1d = lastClose && prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0

          const rsi = calcRSI(closes)
          const macd = calcMACD(closes)
          const bb = calcBB(closes)
          const volumeRatio = calcVolumeRatio(volumes)
          const profile = (profileArr as Array<Record<string, unknown>>)[0] ?? null
          const newsItems = news.map((n) => ({ title: n.title, source: n.metadata.source, time: n.time.toISOString() }))

          dataSnapshot = { symbol, assetClass, type, bars: bars.length, rsi, macd, bb, volumeRatio, change1d, lastClose, profile, newsItems }
          prompt = buildShortEquityPrompt({ symbol, lang: language, lastClose, change1d, rsi, macd, bb, volumeRatio, profile, newsItems })
        } else {
          await onProgress('data', t('재무 데이터 수집 중...', 'Collecting financial data...'))
          // getEstimateConsensus and getInsiderTrading are FMP-premium-only for non-US symbols.
          // Skip them for KRX stocks to avoid 402 errors and empty sections.
          const [profileArr, income, balance, cash, metrics, estimates, insider, historical, news] = await Promise.all([
            equityClient.getProfile({ symbol, provider: ep }).catch(() =>
              equityClient.getProfile({ symbol, provider: 'yfinance' }).catch(() => [])),
            equityClient.getIncomeStatement({ symbol, period: 'annual', limit: 4, provider: ep }).catch(() => []),
            equityClient.getBalanceSheet({ symbol, period: 'annual', limit: 4, provider: ep }).catch(() => []),
            equityClient.getCashFlow({ symbol, period: 'annual', limit: 4, provider: ep }).catch(() => []),
            equityClient.getKeyMetrics({ symbol, limit: 4, provider: ep }).catch(() => []),
            ep === 'fmp'
              ? equityClient.getEstimateConsensus({ symbol, provider: 'fmp' }).catch(() => [])
              : Promise.resolve([]),
            ep === 'fmp'
              ? equityClient.getInsiderTrading({ symbol, provider: 'fmp' }).catch(() => [])
              : Promise.resolve([]),
            equityClient.getHistorical({ symbol, start_date: this.nDaysAgo(365), interval: '1w' }).catch(() => []),
            newsProvider.getNewsV2({ endTime: new Date(), lookback: '7d', limit: 15 }).catch(() => []),
          ])

          const bars = (historical as Array<Record<string, unknown>>)
            .filter((d) => d.close != null)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          const price52wHigh = bars.reduce((m, d) => Math.max(m, Number(d.high ?? 0)), 0)
          const price52wLow = bars.reduce((m, d) => Math.min(m, Number(d.low ?? m)), Infinity)
          const lastClose = Number(bars.at(-1)?.close ?? 0)
          const newsItems = news.map((n) => ({ title: n.title, source: n.metadata.source, time: n.time.toISOString() }))

          dataSnapshot = {
            symbol, assetClass, type,
            provider: ep,
            profile: (profileArr as unknown[])[0] ?? null,
            income: (income as unknown[]).slice(0, 4),
            balance: (balance as unknown[]).slice(0, 4),
            cash: (cash as unknown[]).slice(0, 4),
            metrics: (metrics as unknown[]).slice(0, 4),
            estimates: (estimates as unknown[]).slice(0, 3),
            insider: (insider as unknown[]).slice(0, 10),
            lastClose, price52wHigh, price52wLow, newsItems,
            dataNote: ep === 'yfinance'
              ? 'This is a Korean/non-US stock. Analyst price-target consensus and insider trading filings are not available. Financial data sourced from yfinance.'
              : undefined,
          }
          prompt = buildLongEquityPrompt({ symbol, lang: language, lastClose, price52wHigh, price52wLow, dataSnapshot: dataSnapshot as Record<string, unknown> })
        }
      } else if (assetClass === 'crypto') {
        await onProgress('data', t('가격 데이터 수집 중...', 'Collecting price data...'))
        const [historical, news] = await Promise.all([
          cryptoClient.getHistorical({ symbol, start_date: this.nDaysAgo(90), interval: '1d' }).catch(() => []),
          newsProvider.getNewsV2({ endTime: new Date(), lookback: type === 'short' ? '1d' : '7d', limit: type === 'short' ? 10 : 15 }).catch(() => []),
        ])

        await onProgress('indicators', t('기술적 지표 계산 중...', 'Calculating indicators...'))
        const bars = (historical as Array<Record<string, unknown>>)
          .filter((d) => d.close != null)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        const closes = bars.map((d) => Number(d.close))
        const volumes = bars.map((d) => Number(d.volume ?? 0))
        const lastClose = closes.at(-1) ?? 0
        const prevClose = closes.at(-2) ?? lastClose
        const change1d = lastClose && prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0
        const rsi = calcRSI(closes)
        const macd = calcMACD(closes)
        const bb = calcBB(closes)
        const volumeRatio = calcVolumeRatio(volumes)
        const newsItems = news.map((n) => ({ title: n.title, source: n.metadata.source, time: n.time.toISOString() }))

        dataSnapshot = { symbol, assetClass, type, bars: bars.length, rsi, macd, bb, volumeRatio, change1d, lastClose, newsItems }
        prompt = buildCryptoPrompt({ symbol, type, lang: language, lastClose, change1d, rsi, macd, bb, volumeRatio, newsItems })
      } else {
        // currency / commodity
        await onProgress('data', t('관련 뉴스 수집 중...', 'Collecting related news...'))
        const news = await newsProvider.getNewsV2({ endTime: new Date(), lookback: type === 'short' ? '1d' : '7d', limit: 10 }).catch(() => [])
        const newsItems = news.map((n) => ({ title: n.title, source: n.metadata.source, time: n.time.toISOString() }))
        dataSnapshot = { symbol, assetClass, type, newsItems }
        prompt = buildGenericPrompt({ symbol, assetClass: assetClass as 'currency' | 'commodity', type, lang: language, newsItems })
      }

      await onProgress('generating', t('AI 분석 보고서 생성 중...', 'Generating AI analysis report...'))
      const result = await agentCenter.ask(prompt)
      const content = result.text || ''
      const completedAt = new Date().toISOString()

      const detail: ReportDetail = {
        id, symbol, assetClass, type, status: 'done', createdAt, completedAt,
        language, title, dataSnapshot, content, generationMs: Date.now() - startMs,
      }

      await this.store.saveDetail(detail)
      await this.store.updateIndex(id, { status: 'done', completedAt })

      return detail
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await this.store.updateIndex(id, { status: 'error', errorMessage })
      throw err
    }
  }
}
