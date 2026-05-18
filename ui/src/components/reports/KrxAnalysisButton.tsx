/**
 * KrxAnalysisButton — "🇰🇷 한국 특화 분석" button.
 * Visible only for .KS / .KQ symbols.
 * Calls /api/reports/generate-krx and streams SSE progress.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi, type ReportIndex, type GenerateSSEEvent } from '../../api/reports'
import { ReportGeneratingOverlay } from './ReportGeneratingOverlay'
import { ReportDetailModal } from './ReportDetailModal'

interface Props {
  symbol: string
  type: 'short' | 'long'
  onReportCreated?: () => void
}

type State =
  | { phase: 'idle' }
  | { phase: 'generating'; message: string }
  | { phase: 'done'; report: ReportIndex }
  | { phase: 'error'; message: string }

export function KrxAnalysisButton({ symbol, type, onReportCreated }: Props) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<State>({ phase: 'idle' })
  const language = i18n.language.startsWith('ko') ? 'ko' : 'en'
  const ko = language === 'ko'

  const handleClick = async () => {
    setState({ phase: 'generating', message: ko ? '시작하는 중…' : 'Starting…' })
    try {
      const report = await reportsApi.generateKrx(
        { symbol, type, language },
        (event: GenerateSSEEvent) => {
          if (event.type === 'progress') {
            setState({ phase: 'generating', message: event.message })
          }
        },
      )
      setState({ phase: 'done', report })
      onReportCreated?.()
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  const close = () => setState({ phase: 'idle' })

  useEffect(() => {
    if (state.phase !== 'error') return
    const timer = setTimeout(close, 8000)
    return () => clearTimeout(timer)
  }, [state.phase])

  return (
    <>
      <button
        onClick={handleClick}
        disabled={state.phase === 'generating'}
        title={ko ? '키움 API 기반 기관/외인 수급 데이터를 포함한 한국 특화 분석' : 'Korean market analysis with institutional/foreign flow data (Kiwoom API)'}
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <span>🇰🇷</span>
        <span>{ko ? '수급 포함 분석' : 'KRX Analysis'}</span>
      </button>

      {state.phase === 'generating' && (
        <ReportGeneratingOverlay
          type={type}
          message={state.message}
          onCancel={close}
        />
      )}

      {state.phase === 'done' && (
        <ReportDetailModal reportId={state.report.id} onClose={close} />
      )}

      {state.phase === 'error' && (
        <div className="fixed bottom-4 right-4 z-50 bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-[12px] max-w-xs shadow-lg">
          <div className="font-medium mb-1">{t('reports.generateError')}</div>
          <div className="text-red/80">{state.message}</div>
          <button onClick={close} className="mt-2 text-[11px] underline">{t('common.dismiss')}</button>
        </div>
      )}
    </>
  )
}
