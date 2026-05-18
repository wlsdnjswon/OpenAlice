/**
 * KrxFlowPanel — shows Korean market institutional / foreign investor
 * flow data fetched from the report snapshot (krxData field).
 * Displayed only for .KS / .KQ symbols.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi, type KrxFlowData, type KrxFlowRow } from '../../api/reports'

interface Props {
  symbol: string
}

function FlowTable({ rows }: { rows: KrxFlowRow[] }) {
  const visible = rows.slice(0, 10)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] text-text-muted border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-1 pr-3 font-medium text-text">날짜</th>
            <th className="py-1 pr-3 font-medium text-text">종가</th>
            <th className="py-1 pr-3 font-medium text-blue-400">기관누적</th>
            <th className="py-1 pr-3 font-medium text-amber-400">외인누적</th>
            <th className="py-1 font-medium text-text">한도소진</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const orgn = Number(r.orgn_dt_acc)
            const fore = Number(r.for_dt_acc)
            return (
              <tr key={r.dt} className="border-b border-border/40">
                <td className="py-0.5 pr-3">{r.dt.slice(0, 4)}-{r.dt.slice(4, 6)}-{r.dt.slice(6)}</td>
                <td className="py-0.5 pr-3">{Number(r.close_pric).toLocaleString()}</td>
                <td className={`py-0.5 pr-3 ${orgn > 0 ? 'text-blue-400' : orgn < 0 ? 'text-red-400' : ''}`}>
                  {orgn > 0 ? '+' : ''}{orgn.toLocaleString()}
                </td>
                <td className={`py-0.5 pr-3 ${fore > 0 ? 'text-amber-400' : fore < 0 ? 'text-red-400' : ''}`}>
                  {fore > 0 ? '+' : ''}{fore.toLocaleString()}
                </td>
                <td className="py-0.5">{r.limit_exh_rt}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function KrxFlowPanel({ symbol }: Props) {
  const { i18n } = useTranslation()
  const [data, setData] = useState<KrxFlowData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ko = i18n.language.startsWith('ko')

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setLoading(true)

    // Load from the most-recent KRX report for this symbol, if any
    reportsApi.list({ symbol, assetClass: 'equity', limit: 10 }).then((res) => {
      if (cancelled) return
      const krxReport = res.reports
        .filter((r) => r.status === 'done')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .find((r) => r.title.includes('한국 특화') || r.title.includes('KRX-Enhanced'))

      if (!krxReport) { setLoading(false); return }
      return reportsApi.get(krxReport.id)
    }).then((detail) => {
      if (cancelled || !detail) { setLoading(false); return }
      const snap = detail.dataSnapshot as Record<string, unknown>
      const krxData = snap.krxData as KrxFlowData | undefined
      if (krxData) setData(krxData)
      setLoading(false)
    }).catch((e) => {
      if (!cancelled) {
        setError(String(e))
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [symbol])

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-secondary p-4 text-[12px] text-text-muted animate-pulse">
        {ko ? '수급 데이터 로딩 중…' : 'Loading flow data…'}
      </div>
    )
  }

  if (error || !data) return null

  const foreign = data.foreignLatest
  const rows = data.institTrend?.rows ?? []
  const themes = data.themes ?? []

  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">
          {ko ? '🇰🇷 한국 시장 수급 분석' : '🇰🇷 KRX Flow Analysis'}
        </span>
        <span className="text-[10px] text-text-muted bg-bg-tertiary border border-border rounded px-1.5 py-0.5">
          Kiwoom API
        </span>
      </div>

      {foreign && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bg-tertiary rounded p-2 text-center">
            <div className="text-[10px] text-text-muted mb-0.5">{ko ? '외국인 보유비중' : 'Foreign Holdings'}</div>
            <div className="text-[13px] font-medium text-amber-400">{foreign.wght}%</div>
          </div>
          <div className="bg-bg-tertiary rounded p-2 text-center">
            <div className="text-[10px] text-text-muted mb-0.5">{ko ? '한도소진율' : 'Limit Exhaustion'}</div>
            <div className="text-[13px] font-medium text-text">{foreign.limit_exh_rt}%</div>
          </div>
          <div className="bg-bg-tertiary rounded p-2 text-center">
            <div className="text-[10px] text-text-muted mb-0.5">{ko ? '최근 변동' : 'Recent Change'}</div>
            <div className={`text-[13px] font-medium ${Number(foreign.chg_qty) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {Number(foreign.chg_qty) >= 0 ? '+' : ''}{Number(foreign.chg_qty).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <div className="text-[11px] text-text-muted mb-1.5">
            {ko ? '기관/외인 30일 매매 추이 (최근 10일)' : 'Institutional/Foreign 30d Trend (last 10 days)'}
          </div>
          <FlowTable rows={rows} />
        </div>
      )}

      {themes.length > 0 && (
        <div>
          <div className="text-[11px] text-text-muted mb-1.5">{ko ? '테마 소속' : 'Theme Groups'}</div>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((t) => (
              <span key={t.thema_grp_cd} className="text-[10px] bg-accent/10 text-accent border border-accent/20 rounded px-2 py-0.5">
                {t.thema_nm}
                <span className="text-text-muted ml-1">({t.stk_num}종목)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
