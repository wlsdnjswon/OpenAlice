/**
 * Prompt builders for the KRX-enhanced (한국 특화) analysis mode.
 * Injects institutional/foreign flow + theme data on top of the
 * base technical analysis context.
 */

import type { MACDResult, BBResult } from './indicators.js'
import type { KrxFlowData } from './krx-data-service.js'

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

function buildFlowSection(krx: KrxFlowData, lang: Lang): string {
  const flt = krx.foreignLatest
  const rows = krx.institTrend.rows.slice(0, 10)

  const foreignSummary = flt
    ? lang === 'ko'
      ? `외국인 보유비중: ${flt.wght}% | 한도소진율: ${flt.limit_exh_rt}% | 최근 변동수량: ${flt.chg_qty}주`
      : `Foreign holdings: ${flt.wght}% | Limit exhaustion: ${flt.limit_exh_rt}% | Recent change: ${flt.chg_qty} shares`
    : lang === 'ko' ? '(데이터 없음)' : '(No data)'

  let trendTable = ''
  if (rows.length > 0) {
    const header = lang === 'ko'
      ? '| 일자 | 종가 | 기관누적 | 외인누적 | 한도소진율 |'
      : '| Date | Close | Inst.Cum | For.Cum | Limit% |'
    const sep = '|------|------|----------|---------|---------|'
    const body = rows.map((r) =>
      `| ${r.dt} | ${r.close_pric} | ${r.orgn_dt_acc} | ${r.for_dt_acc} | ${r.limit_exh_rt}% |`
    ).join('\n')
    trendTable = `\n${header}\n${sep}\n${body}`
  } else {
    trendTable = lang === 'ko' ? '\n(수급 추이 데이터 없음)' : '\n(No flow data available)'
  }

  const themeList = krx.themes.length > 0
    ? krx.themes.map((t) => `${t.thema_nm} (종목수: ${t.stk_num})`).join(', ')
    : lang === 'ko' ? '테마 정보 없음' : 'No theme data'

  if (lang === 'ko') {
    return `
## 한국 시장 수급 데이터 (키움 API)

### 외국인 현황
${foreignSummary}

### 기관/외인 30일 매매 추이
${trendTable}

### 테마 소속
${themeList}
`
  } else {
    return `
## Korean Market Flow Data (Kiwoom API)

### Foreign Investor Status
${foreignSummary}

### Institutional / Foreign 30-Day Trend
${trendTable}

### Theme Associations
${themeList}
`
  }
}

// ─── KRX Short-Term ──────────────────────────────────────────────────────────

export interface KrxShortParams {
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
  krx: KrxFlowData
}

export function buildKrxShortPrompt(p: KrxShortParams): string {
  const name = String(p.profile?.name ?? p.profile?.long_name ?? p.symbol)
  const sector = String(p.profile?.sector ?? 'Unknown')
  const industry = String(p.profile?.industry_category ?? p.profile?.industry_group ?? '')

  return `${langInstruction(p.lang)}

You are an expert Korean equity analyst with access to real-time domestic institutional and foreign investor flow data. Generate a structured **한국 시장 특화 단기 분석 보고서** for ${p.symbol} (${name}).

## 시장 현황
| 항목 | 값 |
|------|-------|
| 현재가 | ₩${fmt(p.lastClose, 0)} |
| 전일대비 | ${pct(p.change1d)} |
| 업종/산업 | ${sector}${industry ? ` / ${industry}` : ''} |

## 기술적 지표
| 지표 | 값 및 해석 |
|-----------|----------------------|
| RSI(14) | ${rsiLabel(p.rsi, p.lang)} |
| MACD | ${macdLabel(p.macd, p.lang)} |
| 볼린저밴드 | ${bbLabel(p.bb, p.lang)} |
| 거래량비율 | ${p.volumeRatio != null ? `${fmt(p.volumeRatio)}× (20일 평균 대비)` : 'N/A'} |
${buildFlowSection(p.krx, p.lang)}
## 관련 뉴스 (최근 24시간)
${newsBlock(p.newsItems, p.lang)}

---

**분석 요청:** 위의 기술적 지표와 **기관/외국인 수급 데이터**를 종합하여 다음 섹션을 작성하세요:

1. **수급 종합 평가** — 외국인/기관의 최근 포지션 변화와 그 의미
2. **기술적 분석** — 매수/매도 신호 종합
3. **단기 매매 전략** — 진입 근거, 목표가 범위, 손절 수준
4. **테마 분석** — 해당 테마의 시장 내 모멘텀
5. **리스크 요인** — 수급/기술적 관점의 하방 위험

${p.lang === 'ko' ? '응답은 구조화된 마크다운 형식으로 작성해 주세요.' : 'Write the response in structured Markdown format.'}
`
}

// ─── KRX Long-Term ───────────────────────────────────────────────────────────

export interface KrxLongParams {
  symbol: string
  lang: Lang
  lastClose: number
  price52wHigh: number
  price52wLow: number
  dataSnapshot: Record<string, unknown>
  krx: KrxFlowData
}

export function buildKrxLongPrompt(p: KrxLongParams): string {
  const snap = p.dataSnapshot
  const profile = snap.profile as Record<string, unknown> | null
  const name = String(profile?.name ?? profile?.long_name ?? p.symbol)
  const sector = String(profile?.sector ?? 'Unknown')

  const newsItems = Array.isArray(snap.newsItems)
    ? snap.newsItems as Array<{ title: string; source: string | null | undefined; time: string }>
    : []

  return `${langInstruction(p.lang)}

You are an expert Korean equity analyst. Generate a comprehensive **한국 시장 특화 장기 투자 분석 보고서** for ${p.symbol} (${name}).

## 기업 개요
- **업종:** ${sector}
- **현재가:** ₩${fmt(p.lastClose, 0)}
- **52주 고가:** ₩${fmt(p.price52wHigh, 0)}
- **52주 저가:** ₩${fmt(p.price52wLow, 0)}
${buildFlowSection(p.krx, p.lang)}
## 재무 데이터 (yfinance 기준)
${JSON.stringify({
  income: snap.income,
  balance: snap.balance,
  cash: snap.cash,
  metrics: snap.metrics,
}, null, 2)}

## 관련 뉴스 (최근 7일)
${newsBlock(newsItems, p.lang)}

---

**분석 요청:** 위 데이터를 바탕으로 다음 섹션을 포함한 장기 투자 분석 보고서를 작성하세요:

1. **기업 펀더멘털 분석** — 매출/이익 추이, 재무 건전성
2. **한국 시장 수급 구조** — 외국인/기관 장기 포지셔닝 해석
3. **밸류에이션 분석** — 현재 가격의 적정성
4. **테마 & 산업 포지셔닝** — 한국 주식 시장 내 테마 모멘텀
5. **장기 투자 결론** — 매수/보유/매도 의견 및 목표 가격
6. **리스크 요인** — 거시/산업/기업별 하방 리스크

${p.lang === 'ko' ? '응답은 구조화된 마크다운 형식으로 작성해 주세요.' : 'Write the response in structured Markdown format.'}
`
}
