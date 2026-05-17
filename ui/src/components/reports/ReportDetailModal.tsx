import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi, type ReportDetail } from '../../api/reports'
import { Dialog } from '../uta/Dialog'
import { MarkdownContent } from '../MarkdownContent'

interface Props {
  reportId: string
  onClose: () => void
}

const TYPE_BADGE_CLASS = {
  short: 'bg-accent/15 text-accent border-accent/20',
  long: 'bg-green/15 text-green border-green/20',
} as const

export function ReportDetailModal({ reportId, onClose }: Props) {
  const { t } = useTranslation()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    reportsApi.get(reportId)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reportId])

  const duration = report?.generationMs
    ? report.generationMs < 60_000
      ? `${(report.generationMs / 1000).toFixed(1)}s`
      : `${Math.round(report.generationMs / 1000)}s`
    : null

  return (
    <Dialog onClose={onClose} width="w-[860px]">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[14px] font-semibold text-text truncate">{report?.title ?? t('reports.detail')}</h2>
          {report && (
            <span className={`shrink-0 px-1.5 py-0.5 text-[10px] rounded border font-medium ${TYPE_BADGE_CLASS[report.type]}`}>
              {report.type === 'short' ? t('reports.typeShort') : t('reports.typeLong')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {duration && <span className="text-[11px] text-text-muted">{t('reports.generatedIn', { duration })}</span>}
          <button onClick={onClose} className="text-[18px] leading-none text-text-muted hover:text-text">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            {t('common.loading')}
          </div>
        )}
        {error && <div className="text-[12px] text-red">{error}</div>}
        {report && !loading && (
          <MarkdownContent text={report.content} className="text-[13px]" />
        )}
      </div>

      {report && (
        <div className="px-5 py-2.5 border-t border-border flex items-center justify-between text-[11px] text-text-muted/70">
          <span>{report.symbol} · {report.assetClass}</span>
          <span>{new Date(report.createdAt).toLocaleString()}</span>
        </div>
      )}
    </Dialog>
  )
}
