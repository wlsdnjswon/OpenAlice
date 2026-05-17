import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { reportsApi, type ReportIndex, type ReportAssetClass } from '../../api/reports'
import { ConfirmDialog } from '../ConfirmDialog'
import { ReportDetailModal } from './ReportDetailModal'
import { Card } from '../market/Card'

interface Props {
  symbol: string
  assetClass: ReportAssetClass
  /** Increment to trigger a refresh from outside (e.g., after generation) */
  refreshKey?: number
}

const STATUS_BADGE: Record<string, string> = {
  done: 'bg-green/10 text-green border-green/20',
  generating: 'bg-accent/10 text-accent border-accent/20 animate-pulse',
  error: 'bg-red/10 text-red border-red/20',
}

export function ReportListPanel({ symbol, assetClass, refreshKey }: Props) {
  const { t } = useTranslation()
  const [reports, setReports] = useState<ReportIndex[]>([])
  const [loading, setLoading] = useState(true)
  const [viewId, setViewId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsApi.list({ symbol, assetClass, limit: 20 })
      setReports(res.reports)
    } catch { /* ignore */ }
    setLoading(false)
  }, [symbol, assetClass])

  useEffect(() => { load() }, [load, refreshKey])

  const handleDelete = async () => {
    if (!deleteId) return
    await reportsApi.delete(deleteId)
    setDeleteId(null)
    await load()
  }

  const info = t('reports.listInfo')

  if (loading) return <Card title={t('reports.listTitle')} info={info}><div className="text-[12px] text-text-muted">{t('common.loading')}</div></Card>
  if (!reports.length) return <Card title={t('reports.listTitle')} info={info}><div className="text-[12px] text-text-muted">{t('reports.noReports')}</div></Card>

  return (
    <>
      <Card title={t('reports.listTitle')} info={info}>
        <div className="flex flex-col gap-1.5">
          {reports.map((r) => (
            <div
              key={r.id}
              className="group flex items-center gap-2 px-2.5 py-2 rounded bg-bg-secondary/40 hover:bg-bg-secondary border border-border/50 hover:border-border cursor-pointer transition-colors"
              onClick={() => r.status === 'done' ? setViewId(r.id) : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`shrink-0 px-1 py-0.5 text-[9px] rounded border font-medium uppercase tracking-wide ${r.type === 'short' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-green/10 text-green border-green/20'}`}>
                    {r.type === 'short' ? t('reports.typeShort') : t('reports.typeLong')}
                  </span>
                  <span className={`shrink-0 px-1 py-0.5 text-[9px] rounded border ${STATUS_BADGE[r.status] ?? ''}`}>
                    {t(`reports.status.${r.status}`)}
                  </span>
                </div>
                <p className="text-[12px] text-text truncate">{r.title}</p>
                <p className="text-[10px] text-text-muted/60">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(r.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted/60 hover:text-red transition-all"
                aria-label={t('common.delete')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </Card>

      {viewId && <ReportDetailModal reportId={viewId} onClose={() => setViewId(null)} />}

      {deleteId && (
        <ConfirmDialog
          title={t('reports.deleteTitle')}
          message={t('reports.deleteMessage')}
          confirmLabel={t('common.delete')}
          variant="danger"
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
        />
      )}
    </>
  )
}
