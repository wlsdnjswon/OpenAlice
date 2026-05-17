import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi, type ReportAssetClass, type ReportIndex, type GenerateSSEEvent } from '../../api/reports'
import { ReportGeneratingOverlay } from './ReportGeneratingOverlay'
import { ReportDetailModal } from './ReportDetailModal'

interface Props {
  symbol: string
  assetClass: ReportAssetClass
  onReportCreated?: () => void
}

type GenerateState =
  | { phase: 'idle' }
  | { phase: 'generating'; type: 'short' | 'long'; message: string }
  | { phase: 'done'; report: ReportIndex }
  | { phase: 'error'; message: string }

export function ReportGenerateButtons({ symbol, assetClass, onReportCreated }: Props) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<GenerateState>({ phase: 'idle' })

  const language = i18n.language.startsWith('ko') ? 'ko' : 'en'

  const handleGenerate = async (type: 'short' | 'long') => {
    setState({ phase: 'generating', type, message: t('reports.starting') })
    try {
      const report = await reportsApi.generate(
        { symbol, assetClass, type, language },
        (event: GenerateSSEEvent) => {
          if (event.type === 'progress') {
            setState({ phase: 'generating', type, message: event.message })
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

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleGenerate('short')}
          disabled={state.phase === 'generating'}
          className="px-2.5 py-1 text-[11px] rounded bg-accent/15 text-accent hover:bg-accent/25 border border-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('reports.shortBtn')}
        </button>
        <button
          onClick={() => handleGenerate('long')}
          disabled={state.phase === 'generating'}
          className="px-2.5 py-1 text-[11px] rounded bg-bg-secondary text-text-muted hover:text-text border border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('reports.longBtn')}
        </button>
      </div>

      {state.phase === 'generating' && (
        <ReportGeneratingOverlay
          type={state.type}
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
