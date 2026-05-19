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

// ─── Section builders ─────────────────────────────────────────────────────────

function buildBasicInfoSection(krx: KrxFlowData, lang: Lang): string {
  const b = krx.basicInfo
  if (!b) return '\n'

  if (lang === 'ko') {
    return `
## 주식 기본 정보 (키움 ka10001)
| 항목 | 값 |
|------|-----|
| 시가총액 | ${b.mac || 'N/A'}억 원 (시총비중 ${b.mac_wght || 'N/A'}%) |
| 상장주식수 | ${b.flo_stk || 'N/A'}주 |
| PER | ${b.per || 'N/A'} |
| EPS | ${b.eps || 'N/A'}원 |
| ROE | ${b.roe || 'N/A'}% |
| PBR | ${b.pbr || 'N/A'} |
| BPS | ${b.bps || 'N/A'}원 |
| 신용비율 | ${b.crd_rt || 'N/A'}% |
| 외인소진률 | ${b.for_exh_rt || 'N/A'}% |
| 52주 최고 | ₩${b['250hgst'] || b.oyr_hgst || 'N/A'} |
| 52주 최저 | ₩${b['250lwst'] || b.oyr_lwst || 'N/A'} |
| 기준가 | ₩${b.base_pric || 'N/A'} |
| 상한가 | ₩${b.upl_pric || 'N/A'} |
| 하한가 | ₩${b.lst_pric || 'N/A'} |
| 매출액 | ${b.sale_amt || 'N/A'}억 원 |
| 영업이익 | ${b.bus_pro || 'N/A'}억 원 |
| 당기순이익 | ${b.cup_nga || 'N/A'}억 원 |
`
  } else {
    return `
## Stock Fundamentals (Kiwoom ka10001)
| Item | Value |
|------|-------|
| Market Cap | ${b.mac || 'N/A'} (weight: ${b.mac_wght || 'N/A'}%) |
| Shares Listed | ${b.flo_stk || 'N/A'} |
| PER | ${b.per || 'N/A'} |
| EPS | ${b.eps || 'N/A'} KRW |
| ROE | ${b.roe || 'N/A'}% |
| PBR | ${b.pbr || 'N/A'} |
| BPS | ${b.bps || 'N/A'} KRW |
| Credit Ratio | ${b.crd_rt || 'N/A'}% |
| Foreign Exhaustion | ${b.for_exh_rt || 'N/A'}% |
| 52W High | ₩${b['250hgst'] || b.oyr_hgst || 'N/A'} |
| 52W Low | ₩${b['250lwst'] || b.oyr_lwst || 'N/A'} |
| Upper Limit | ₩${b.upl_pric || 'N/A'} |
| Lower Limit | ₩${b.lst_pric || 'N/A'} |
`
  }
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
      ? '| 일자 | 종가 | 등락률 | 기관누적 | 외인누적 | 기관일별 | 외인일별 | 한도소진 |'
      : '| Date | Close | Chg% | Inst.Cum | For.Cum | Inst.Day | For.Day | Limit% |'
    const sep = '|------|------|------|---------|--------|---------|--------|--------|'
    const body = rows.map((r) =>
      `| ${r.dt} | ${r.close_pric} | ${r.flu_rt}% | ${r.orgn_dt_acc} | ${r.for_dt_acc} | ${r.orgn_daly_nettrde_qty} | ${r.for_daly_nettrde_qty} | ${r.limit_exh_rt}% |`
    ).join('\n')
    trendTable = `\n${header}\n${sep}\n${body}`
  } else {
    trendTable = lang === 'ko' ? '\n(수급 추이 데이터 없음)' : '\n(No flow data available)'
  }

  const themeList = krx.themes.length > 0
    ? krx.themes.map((t) => `${t.thema_nm} (종목수: ${t.stk_num}${t.flu_rt ? `, 수익률: ${t.flu_rt}%` : ''})`).join(', ')
    : lang === 'ko' ? '테마 정보 없음' : 'No theme data'

  if (lang === 'ko') {
    return `
## 기관/외국인 수급 데이터 (키움 API)

### 외국인 현황
${foreignSummary}
- 기관 추정 평균단가: ${krx.institTrend.orgnAvg ? `₩${krx.institTrend.orgnAvg}` : 'N/A'}
- 외인 추정 평균단가: ${krx.institTrend.forAvg ? `₩${krx.institTrend.forAvg}` : 'N/A'}

### 기관/외인 매매 추이 (최근 10일)
${trendTable}

### 테마 소속
${themeList}
`
  } else {
    return `
## Institutional / Foreign Flow Data (Kiwoom API)

### Foreign Investor Status
${foreignSummary}
- Institutional est. avg price: ${krx.institTrend.orgnAvg ? `₩${krx.institTrend.orgnAvg}` : 'N/A'}
- Foreign est. avg price: ${krx.institTrend.forAvg ? `₩${krx.institTrend.forAvg}` : 'N/A'}

### Institutional / Foreign 10-Day Trend
${trendTable}

### Theme Associations
${themeList}
`
  }
}

function buildShortSellingSection(krx: KrxFlowData, lang: Lang): string {
  const rows = krx.shortSelling.slice(0, 10)
  if (!rows.length) return ''

  const header = lang === 'ko'
    ? '| 일자 | 종가 | 공매도량 | 매매비중 | 공매도대금 |'
    : '| Date | Close | Short Vol | Weight% | Short Amt |'
  const sep = '|------|------|---------|--------|---------|'
  const body = rows.map((r) =>
    `| ${r.dt} | ${r.close_pric} | ${r.shrts_qty} | ${r.trde_wght}% | ${r.shrts_trde_prica} |`
  ).join('\n')

  if (lang === 'ko') {
    return `
## 공매도 추이 (키움 ka10014)
${header}
${sep}
${body}
`
  } else {
    return `
## Short Selling Trend (Kiwoom ka10014)
${header}
${sep}
${body}
`
  }
}

function buildCreditSection(krx: KrxFlowData, lang: Lang): string {
  const rows = krx.creditTrend.slice(0, 10)
  if (!rows.length) return ''

  const header = lang === 'ko'
    ? '| 일자 | 현재가 | 신규 | 상환 | 잔고 | 잔고율 |'
    : '| Date | Price | New | Repaid | Balance | Balance% |'
  const sep = '|------|------|------|------|------|-------|'
  const body = rows.map((r) =>
    `| ${r.dt} | ${r.cur_prc} | ${r.new} | ${r.rpya} | ${r.remn} | ${r.remn_rt}% |`
  ).join('\n')

  if (lang === 'ko') {
    return `
## 신용매매동향 (융자잔고, 키움 ka10013)
${header}
${sep}
${body}
`
  } else {
    return `
## Credit (Margin) Trading Trend (Kiwoom ka10013)
${header}
${sep}
${body}
`
  }
}

function buildExecStrengthSection(krx: KrxFlowData, lang: Lang): string {
  const rows = krx.execStrength.slice(0, 10)
  if (!rows.length) return ''

  const header = lang === 'ko'
    ? '| 일자 | 현재가 | 거래량 | 체결강도 | 5일강도 | 20일강도 | 60일강도 |'
    : '| Date | Price | Volume | Str | 5D Str | 20D Str | 60D Str |'
  const sep = '|------|------|------|------|------|------|------|'
  const body = rows.map((r) =>
    `| ${r.dt} | ${r.cur_prc} | ${r.trde_qty} | ${r.cntr_str} | ${r.cntr_str_5min} | ${r.cntr_str_20min} | ${r.cntr_str_60min} |`
  ).join('\n')

  if (lang === 'ko') {
    return `
## 체결강도 추이 (키움 ka10047)
> 체결강도 = 매수체결량/매도체결량 × 100. 100 초과 시 매수세 우위.
${header}
${sep}
${body}
`
  } else {
    return `
## Execution Strength Trend (Kiwoom ka10047)
> Execution strength = buy volume / sell volume × 100. Above 100 = buy-side dominant.
${header}
${sep}
${body}
`
  }
}

function buildInvestorDetailSection(krx: KrxFlowData, lang: Lang): string {
  const rows = krx.investorDetail.slice(0, 10)
  if (!rows.length) return ''

  const header = lang === 'ko'
    ? '| 일자 | 개인 | 외국인 | 기관계 | 금융투자 | 보험 | 투신 | 은행 |'
    : '| Date | Retail | Foreign | Inst. | FinInvst | Insrnc | Fund | Bank |'
  const sep = '|------|------|------|------|------|------|------|------|'
  const body = rows.map((r) =>
    `| ${r.dt} | ${r.ind_invsr} | ${r.frgnr_invsr} | ${r.orgn} | ${r.fnnc_invt} | ${r.insrnc} | ${r.invtrt} | ${r.bank} |`
  ).join('\n')

  if (lang === 'ko') {
    return `
## 투자자별 순매수 상세 (수량기준, 키움 ka10059)
> (단위: 천주 / 음수=순매도)
${header}
${sep}
${body}
`
  } else {
    return `
## Investor Type Net Buy Detail (by Quantity, Kiwoom ka10059)
> (Unit: 1,000 shares / negative = net sell)
${header}
${sep}
${body}
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

You are an expert Korean equity analyst with access to real-time Kiwoom API data including institutional flow, foreign investor data, short selling, credit trading, execution strength, and investor type breakdown. Generate a **한국 시장 특화 단기 AI 분석 보고서** for ${p.symbol} (${name}).

## 종목 현황
| 항목 | 값 |
|------|-------|
| 현재가 | ₩${fmt(p.lastClose, 0)} |
| 전일대비 | ${pct(p.change1d)} |
| 업종/산업 | ${sector}${industry ? ` / ${industry}` : ''} |
${buildBasicInfoSection(p.krx, p.lang)}
## 기술적 지표 (90일 일봉 기반)
| 지표 | 값 및 해석 |
|-----------|----------------------|
| RSI(14) | ${rsiLabel(p.rsi, p.lang)} |
| MACD(12,26,9) | ${macdLabel(p.macd, p.lang)} |
| 볼린저밴드(20,2) | ${bbLabel(p.bb, p.lang)} |
| 거래량비율 | ${p.volumeRatio != null ? `${fmt(p.volumeRatio)}× (20일 평균 대비)` : 'N/A'} |
${buildFlowSection(p.krx, p.lang)}${buildShortSellingSection(p.krx, p.lang)}${buildCreditSection(p.krx, p.lang)}${buildExecStrengthSection(p.krx, p.lang)}${buildInvestorDetailSection(p.krx, p.lang)}
## 관련 뉴스 (최근 24시간)
${newsBlock(p.newsItems, p.lang)}

---

**분석 요청:** 위의 모든 데이터를 종합하여 다음 섹션을 포함한 전문적인 단기 분석 보고서를 작성하세요. 각 섹션에서 **구체적인 수치(가격, %, 날짜)**를 반드시 제시하세요:

### 1. 📊 수급 종합 평가
- 외국인/기관 최근 포지션 변화 방향성 및 강도 (연속 매수/매도 일수 포함)
- 기관별(금융투자/투신/보험/은행) 동향에서 읽히는 스마트머니 흐름
- 외인소진률 변화가 주가에 미치는 영향 분석

### 2. ⚡ 체결강도 & 모멘텀 분석
- 체결강도 추이로 본 매수세/매도세 변화
- 거래량 비율과 체결강도의 괴리 또는 수렴 해석

### 3. ⚠️ 공매도 & 신용 리스크 평가
- 공매도 매매비중 추이 (증가/감소 추세와 의미)
- 신용 융자 잔고율 변화 (과열/정상 판단)
- 공매도+신용이 결합될 경우 하방 압력 정도

### 4. 📈 기술적 분석 종합
- RSI/MACD/볼린저밴드 각각의 시그널을 종합한 단기 방향성
- 현재 가격 위치 (연중 고저, 볼린저 밴드, 기준가 대비)
- 지지선과 저항선 구체적 가격 제시

### 5. 🎯 단기 매매 전략 (가장 중요)
**다음 3가지를 반드시 구체적인 가격으로 제시하세요:**
- **진입 타점**: 매수를 검토할 가격대 (또는 조건) — 예: "₩XX,XXX ~ ₩XX,XXX 사이 분할매수"
- **1차 목표가**: 수급/기술 분석 기반 단기 목표 가격
- **2차 목표가**: 추가 상승 시 목표 가격
- **손절선**: 이 가격 하향 돌파 시 손절 — 이유 포함
- **투자 기간**: 예상 단기 보유 기간 (예: 3~5 거래일)
- **전략 근거**: 위 5개 분석 결과를 한 문단으로 종합

### 6. 📌 리스크 요인
- 수급/기술/거시적 관점의 구체적 하방 리스크 3가지

${p.lang === 'ko' ? '응답은 구조화된 마크다운 형식으로 작성해 주세요. 각 분석은 데이터 기반으로 명확하게 작성하고, 투자 판단에 직접 활용 가능한 수준의 구체성을 유지하세요.' : 'Write the response in structured Markdown format with specific price levels and data-driven reasoning.'}
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
${buildBasicInfoSection(p.krx, p.lang)}${buildFlowSection(p.krx, p.lang)}${buildExecStrengthSection(p.krx, p.lang)}${buildInvestorDetailSection(p.krx, p.lang)}${buildShortSellingSection(p.krx, p.lang)}
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

**분석 요청:** 위 모든 데이터를 바탕으로 다음 섹션을 포함한 장기 투자 분석 보고서를 작성하세요. 각 섹션에서 **구체적인 수치**를 반드시 제시하세요:

### 1. 📊 기업 펀더멘털 분석
- 매출/영업이익/순이익 추이 및 성장성 (YoY 성장률 계산 포함)
- PER/PBR/ROE 수준의 현재 밸류에이션 평가 (업종 평균 대비)
- 재무 건전성 판단 (부채비율, 유동비율)

### 2. 🌊 한국 시장 수급 구조 분석
- 외국인/기관 장기 포지셔닝 흐름 해석
- 기관별 세부 동향에서 읽히는 장기 스마트머니 방향성
- 외인소진률과 기관 추정 평균단가의 장기적 의미

### 3. ⚡ 기술적 모멘텀 & 수급 강도
- 체결강도 장기 추이 (60일 강도 포함) 분석
- 투자자별 누적 순매수 방향성

### 4. 📈 밸류에이션 & 목표 주가
- 현재 가격이 적정한지 PER/PBR/DCF 관점에서 분석
- **장기 목표 주가 제시 (6개월~1년 기준)**: 근거 포함
- 밸류에이션 상단/하단 범위

### 5. 🎯 장기 투자 결론
- **매수/보유/매도** 의견 명확히 제시
- **최적 분할매수 가격대**: 구체적 범위
- **장기 손절 기준**: 펀더멘털 훼손 시나리오

### 6. ⚠️ 리스크 요인
- 거시(금리/환율/경기), 산업, 기업별 구체적 하방 리스크
- 공매도/신용 리스크가 장기 투자에 미치는 영향

${p.lang === 'ko' ? '응답은 구조화된 마크다운 형식으로 작성해 주세요. 장기 투자자가 직접 의사결정에 활용할 수 있는 수준의 구체적이고 데이터 기반 분석을 제공하세요.' : 'Write the response in structured Markdown format with data-driven analysis and specific price targets.'}
`
}
