import type { MACDResult, BBResult } from './indicators.js'

type Lang = 'ko' | 'en'

const fmt = (n: number | null | undefined, decimals = 2) =>
  n != null ? n.toFixed(decimals) : 'N/A'

const pct = (n: number | null | undefined) =>
  n != null ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'N/A'

function rsiLabel(rsi: number | null, lang: Lang): string {
  if (rsi == null) return 'N/A'
  if (rsi >= 70) return lang === 'ko' ? `${fmt(rsi)} (과매수 구간)` : `${fmt(rsi)} (Overbought)`
  if (rsi <= 30) return lang === 'ko' ? `${fmt(rsi)} (과매도 구간)` : `${fmt(rsi)} (Oversold)`
  return lang === 'ko' ? `${fmt(rsi)} (중립)` : `${fmt(rsi)} (Neutral)`
}

function macdLabel(m: MACDResult | null, lang: Lang): string {
  if (!m) return 'N/A'
  const trend = m.histogram > 0
    ? (lang === 'ko' ? '상승 모멘텀' : 'Bullish momentum')
    : (lang === 'ko' ? '하락 모멘텀' : 'Bearish momentum')
  return `Line=${fmt(m.macdLine, 4)}, Signal=${fmt(m.signalLine, 4)}, Hist=${fmt(m.histogram, 4)} → ${trend}`
}

function bbLabel(bb: BBResult | null, lang: Lang): string {
  if (!bb) return 'N/A'
  const pos = bb.percentB > 0.8
    ? (lang === 'ko' ? '상단 밴드 근접 (과매수)' : 'Near upper band (overbought)')
    : bb.percentB < 0.2
      ? (lang === 'ko' ? '하단 밴드 근접 (과매도)' : 'Near lower band (oversold)')
      : (lang === 'ko' ? '밴드 중간' : 'Mid-band')
  return `Upper=${fmt(bb.upper)}, Middle=${fmt(bb.middle)}, Lower=${fmt(bb.lower)}, %B=${fmt(bb.percentB)} → ${pos}`
}

function newsBlock(items: Array<{ title: string; source: string | null | undefined; time: string }>, lang: Lang): string {
  if (!items.length) return lang === 'ko' ? '(수집된 뉴스 없음)' : '(No recent news collected)'
  return items.map((n) => `- [${n.source ?? '?'}] ${n.title}`).join('\n')
}

function langInstruction(lang: Lang): string {
  return lang === 'ko'
    ? '응답을 **반드시 한국어**로 작성하세요. 전문 금융 용어는 영문 표기를 괄호 안에 병기해도 좋습니다.'
    : 'Write the entire report in **English**.'
}

// ─── Short-term equity ───────────────────────────────────────────────────────

interface ShortEquityParams {
  symbol: string
  lang: Lang
  lastClose: number
  change1d: number
  rsi: number | null
  macd: MACDResult | null
  bb: BBResult | null
  volumeRatio: number | null
  profile: Record<string, unknown> | null
  newsItems: Array<{ title: string; source: string | null | undefined; time: string }>
}

export function buildShortEquityPrompt(p: ShortEquityParams): string {
  const name = String(p.profile?.name ?? p.profile?.long_name ?? p.symbol)
  const sector = String(p.profile?.sector ?? 'Unknown')
  const industry = String(p.profile?.industry_category ?? p.profile?.industry_group ?? '')

  return `${langInstruction(p.lang)}

You are an expert short-term trading analyst. Generate a structured **short-term trading report** for ${p.symbol} (${name}).

## Market Snapshot
| Item | Value |
|------|-------|
| Current Price | $${fmt(p.lastClose)} |
| 1-Day Change | ${pct(p.change1d)} |
| Sector | ${sector}${industry ? ` / ${industry}` : ''} |

## Technical Indicators
| Indicator | Value & Interpretation |
|-----------|----------------------|
| RSI(14) | ${rsiLabel(p.rsi, p.lang)} |
| MACD(12,26,9) | ${macdLabel(p.macd, p.lang)} |
| Bollinger Bands(20,2) | ${bbLabel(p.bb, p.lang)} |
| Volume vs 20-Day Avg | ${p.volumeRatio != null ? `${fmt(p.volumeRatio)}x` : 'N/A'} |

## Recent News (Last 24h)
${newsBlock(p.newsItems, p.lang)}

---

Generate a complete short-term trading report with the following sections. Use markdown headers and be specific and actionable.

### 1. 기술적 분석 요약 / Technical Analysis Summary
Interpret RSI, MACD, Bollinger Bands together. Identify convergence or divergence signals.

### 2. 거래량 분석 / Volume Analysis
Is volume confirming the price move? What does this suggest?

### 3. 뉴스 감성 / News Sentiment
Classify recent news as bullish / bearish / neutral with brief reasoning.

### 4. 단기 전망 / Short-Term Outlook (1–5 Days)
Likely price direction and key levels to watch.

### 5. 매매 의견 / Trading Recommendation
- **Stance**: BUY / HOLD / SELL
- **Entry zone**: (price range)
- **Target price**: (price)
- **Stop-loss**: (price)
- **Risk/Reward ratio**: (calculated)

### 6. 주요 리스크 / Key Risks
What could invalidate this setup?

*Report generated: ${new Date().toISOString()}*`
}

// ─── Long-term equity ────────────────────────────────────────────────────────

interface LongEquityParams {
  symbol: string
  lang: Lang
  lastClose: number
  price52wHigh: number
  price52wLow: number
  dataSnapshot: Record<string, unknown>
}

function formatKeyMetrics(metrics: unknown[]): string {
  if (!metrics.length) return 'N/A'
  const m = metrics[0] as Record<string, unknown>
  const fields = ['pe_ratio', 'price_to_book', 'return_on_equity', 'return_on_assets',
    'debt_to_equity', 'current_ratio', 'free_cash_flow_yield', 'earnings_per_share',
    'revenue_per_share', 'dividend_yield']
  return fields
    .filter((f) => m[f] != null)
    .map((f) => `${f}: ${typeof m[f] === 'number' ? (m[f] as number).toFixed(4) : m[f]}`)
    .join(', ')
}

function formatFinancials(rows: unknown[], fields: string[]): string {
  if (!rows.length) return 'N/A'
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    const date = String(row.date ?? row.period ?? '')
    const vals = fields.filter((f) => row[f] != null)
      .map((f) => `${f}=${row[f]}`)
      .join(', ')
    return `  ${date}: ${vals}`
  }).join('\n')
}

function formatEstimates(estimates: unknown[]): string {
  if (!estimates.length) return 'N/A'
  const e = estimates[0] as Record<string, unknown>
  return Object.entries(e).filter(([, v]) => v != null).slice(0, 10)
    .map(([k, v]) => `${k}: ${v}`).join(', ')
}

function formatInsiders(insiders: unknown[]): string {
  if (!insiders.length) return 'No recent insider activity'
  return insiders.slice(0, 5).map((t) => {
    const tx = t as Record<string, unknown>
    return `  ${tx.filing_date ?? ''} ${tx.transaction_type ?? ''} by ${tx.reporting_name ?? tx.owner ?? '?'}: ${tx.securities_transacted ?? ''} shares @ $${tx.price ?? '?'}`
  }).join('\n')
}

export function buildLongEquityPrompt(p: LongEquityParams): string {
  const snap = p.dataSnapshot as Record<string, unknown>
  const profile = (snap.profile ?? {}) as Record<string, unknown>
  const name = String(profile.name ?? profile.long_name ?? p.symbol)
  const sector = String(profile.sector ?? 'Unknown')
  const industry = String(profile.industry_category ?? profile.industry_group ?? '')
  const desc = String(profile.long_description ?? profile.short_description ?? '')
  const dataNote = snap.dataNote as string | undefined

  const metrics = (snap.metrics as unknown[]) ?? []
  const income = (snap.income as unknown[]) ?? []
  const balance = (snap.balance as unknown[]) ?? []
  const cash = (snap.cash as unknown[]) ?? []
  const estimates = (snap.estimates as unknown[]) ?? []
  const insider = (snap.insider as unknown[]) ?? []
  const newsItems = (snap.newsItems as Array<{ title: string; source: string | null; time: string }>) ?? []

  return `${langInstruction(p.lang)}${dataNote ? `\n\n> **Data note**: ${dataNote}` : ''}

You are an expert value investor and equity analyst. Generate a comprehensive **long-term investment report** for ${p.symbol} (${name}).

## Company Overview
- **Sector**: ${sector}${industry ? ` / ${industry}` : ''}
- **52-Week Range**: $${fmt(p.price52wLow)} – $${fmt(p.price52wHigh)}
- **Current Price**: $${fmt(p.lastClose)}
${desc ? `- **Business**: ${desc.slice(0, 400)}` : ''}

## Key Financial Metrics (Most Recent)
${formatKeyMetrics(metrics)}

## Income Statement (Annual, Last 4 Years)
${formatFinancials(income, ['date', 'revenue', 'gross_profit', 'operating_income', 'net_income', 'eps'])}

## Balance Sheet (Annual, Last 4 Years)
${formatFinancials(balance, ['date', 'total_assets', 'total_debt', 'total_equity', 'cash_and_equivalents', 'current_ratio'])}

## Cash Flow (Annual, Last 4 Years)
${formatFinancials(cash, ['date', 'operating_cash_flow', 'capital_expenditure', 'free_cash_flow', 'dividends_paid'])}

## Analyst Consensus
${formatEstimates(estimates)}

## Insider Trading (Recent)
${formatInsiders(insider)}

## Recent News (Last 7 Days)
${newsBlock(newsItems, p.lang)}

---

Generate a comprehensive long-term investment report with the following sections. Be analytical and data-driven.

### 1. 비즈니스 분석 / Business Analysis
Evaluate the business model, competitive moat, and market position.

### 2. 재무 건전성 / Financial Health
Analyze debt levels, liquidity, free cash flow generation, and sustainability.

### 3. 성장성 평가 / Growth Assessment
Revenue and earnings growth trends over 4 years. Is growth accelerating or decelerating?

### 4. 밸류에이션 / Valuation
Is the stock fairly valued? Compare P/E, P/B, FCF yield against sector norms. Is there upside to the analyst target?

### 5. 리스크 요인 / Risk Factors
Insider selling patterns, leverage risk, macro sensitivity, regulatory exposure.

### 6. 뉴스·이슈 환경 / Macro & News Environment
How do recent news and macro trends affect the investment thesis?

### 7. 투자 의견 / Investment Verdict
- **Rating**: STRONG BUY / BUY / NEUTRAL / SELL / STRONG SELL
- **Investment horizon**: 12–36 months
- **Target price range**: (justified by P/E band or DCF rationale)
- **Thesis summary**: (2–3 sentences)

*Report generated: ${new Date().toISOString()}*`
}

// ─── Crypto (short + long) ───────────────────────────────────────────────────

interface CryptoParams {
  symbol: string
  type: 'short' | 'long'
  lang: Lang
  lastClose: number
  change1d: number
  rsi: number | null
  macd: MACDResult | null
  bb: BBResult | null
  volumeRatio: number | null
  newsItems: Array<{ title: string; source: string | null | undefined; time: string }>
}

export function buildCryptoPrompt(p: CryptoParams): string {
  const horizon = p.type === 'short'
    ? (p.lang === 'ko' ? '단기 (1–5일)' : 'Short-term (1–5 days)')
    : (p.lang === 'ko' ? '중장기 (1–3개월)' : 'Medium-term (1–3 months)')

  return `${langInstruction(p.lang)}

You are an expert crypto market analyst. Generate a **${horizon} trading report** for ${p.symbol}.

## Market Snapshot
| Item | Value |
|------|-------|
| Current Price | $${fmt(p.lastClose)} |
| 1-Day Change | ${pct(p.change1d)} |

## Technical Indicators
| Indicator | Value |
|-----------|-------|
| RSI(14) | ${rsiLabel(p.rsi, p.lang)} |
| MACD(12,26,9) | ${macdLabel(p.macd, p.lang)} |
| Bollinger Bands(20,2) | ${bbLabel(p.bb, p.lang)} |
| Volume vs 20-Day Avg | ${p.volumeRatio != null ? `${fmt(p.volumeRatio)}x` : 'N/A'} |

## Recent News (${p.type === 'short' ? 'Last 24h' : 'Last 7 Days'})
${newsBlock(p.newsItems, p.lang)}

---

Generate a complete crypto investment report covering:

### 1. 기술적 분석 / Technical Analysis
Interpret all indicators. Identify the dominant trend, momentum, and volatility state.

### 2. 감성 분석 / Sentiment Analysis
Assess news sentiment. Any significant events (protocol updates, regulation, exchange news)?

### 3. 주요 가격대 / Key Price Levels
Support and resistance zones based on Bollinger Bands and recent price action.

### 4. 매매 의견 / Trading Recommendation
- **Stance**: BUY / HOLD / SELL
- **Entry zone**:
- **Target**:
- **Stop-loss**:
- **Timeframe**: ${horizon}

### 5. 리스크 / Key Risks
Crypto-specific risks: liquidity, volatility, regulatory, correlation with BTC.

*Report generated: ${new Date().toISOString()}*`
}

// ─── Generic (currency / commodity) ─────────────────────────────────────────

interface GenericParams {
  symbol: string
  assetClass: 'currency' | 'commodity'
  type: 'short' | 'long'
  lang: Lang
  newsItems: Array<{ title: string; source: string | null | undefined; time: string }>
}

export function buildGenericPrompt(p: GenericParams): string {
  const assetLabel = p.assetClass === 'currency'
    ? (p.lang === 'ko' ? '통화' : 'Currency')
    : (p.lang === 'ko' ? '원자재' : 'Commodity')
  const horizon = p.type === 'short'
    ? (p.lang === 'ko' ? '단기' : 'Short-term')
    : (p.lang === 'ko' ? '중장기' : 'Medium-term')

  return `${langInstruction(p.lang)}

You are a financial analyst. Generate a **${horizon} outlook report** for the ${assetLabel} ${p.symbol}.

## Recent News (${p.type === 'short' ? 'Last 24h' : 'Last 7 Days'})
${newsBlock(p.newsItems, p.lang)}

---

Based on the available news and your knowledge of this asset:

### 1. 시장 동향 / Market Context
What macro factors or events are currently driving ${p.symbol}?

### 2. 뉴스 감성 / News Sentiment
Classify recent coverage as bullish / bearish / neutral.

### 3. 전망 / Outlook
${horizon} directional view with key levels to watch.

### 4. 투자 의견 / View
- **Stance**: BULLISH / NEUTRAL / BEARISH
- **Key level to watch**:
- **Horizon**: ${horizon}

### 5. 리스크 / Risks
What could change this view?

*Note: Limited real-time price data available for this asset class. Analysis is news-driven.*
*Report generated: ${new Date().toISOString()}*`
}
