import { useState } from 'react'
import { QuoteHeader } from '../../components/market/QuoteHeader'
import { ProfilePanel } from '../../components/market/ProfilePanel'
import { KeyMetricsPanel } from '../../components/market/KeyMetricsPanel'
import { FinancialStatementsPanel } from '../../components/market/FinancialStatementsPanel'
import { KlinePanel } from '../../components/market/KlinePanel'
import { TradeableContractsPanel } from '../../components/market/TradeableContractsPanel'
import { KrxFlowPanel } from '../../components/market/KrxFlowPanel'
import { ReportGenerateButtons } from '../../components/reports/ReportGenerateButtons'
import { ReportListPanel } from '../../components/reports/ReportListPanel'

const isKrxSymbol = (sym: string) => /\.(KS|KQ)$/i.test(sym)

interface Props {
  symbol: string
}

export function EquityDetail({ symbol }: Props) {
  const [reportRefreshKey, setReportRefreshKey] = useState(0)

  return (
    <div className="flex flex-col gap-3">
      <QuoteHeader symbol={symbol} />

      <div className="h-[360px] shrink-0">
        <KlinePanel selection={{ symbol, assetClass: 'equity' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ProfilePanel
          symbol={symbol}
          headerRight={
            <ReportGenerateButtons
              symbol={symbol}
              assetClass="equity"
              onReportCreated={() => setReportRefreshKey((k) => k + 1)}
            />
          }
        />
        <KeyMetricsPanel symbol={symbol} />
      </div>

      <ReportListPanel symbol={symbol} assetClass="equity" refreshKey={reportRefreshKey} />

      {isKrxSymbol(symbol) && <KrxFlowPanel symbol={symbol} />}

      <TradeableContractsPanel symbol={symbol} assetClass="equity" />

      <FinancialStatementsPanel symbol={symbol} />
    </div>
  )
}
