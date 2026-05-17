import { useTranslation } from 'react-i18next'
import { Dialog } from '../uta/Dialog'

interface Props {
  type: 'short' | 'long'
  message: string
  onCancel: () => void
}

export function ReportGeneratingOverlay({ type, message, onCancel }: Props) {
  const { t } = useTranslation()

  return (
    <Dialog onClose={() => {}} width="w-[420px]">
      <div className="px-6 py-5 flex flex-col items-center gap-4 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        <div>
          <p className="text-[14px] font-medium text-text mb-1">
            {type === 'short' ? t('reports.generatingShort') : t('reports.generatingLong')}
          </p>
          <p className="text-[12px] text-text-muted">{message}</p>
        </div>
        <p className="text-[11px] text-text-muted/60">{t('reports.generatingHint')}</p>
        <button onClick={onCancel} className="text-[11px] text-text-muted hover:text-text underline">
          {t('common.cancel')}
        </button>
      </div>
    </Dialog>
  )
}
