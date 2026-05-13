import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type AppConfig } from '../api'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { Toggle } from '../components/Toggle'
import { useConfigPage } from '../hooks/useConfigPage'
import { PageHeader } from '../components/PageHeader'

type MarketDataConfig = Record<string, unknown>

// ==================== Constants ====================

const PROVIDER_OPTIONS: Record<string, string[]> = {
  equity:    ['yfinance', 'fmp', 'intrinio'],
  crypto:    ['yfinance', 'fmp'],
  currency:  ['yfinance', 'fmp'],
  commodity: ['yfinance', 'fmp'],
}

const ASSET_KEYS = ['equity', 'crypto', 'currency', 'commodity'] as const

type Tier = 'free' | 'freemium' | 'paid'

interface ProviderEntry {
  key: string
  name: string
  tier: Tier
}

const ALL_PROVIDERS: ProviderEntry[] = [
  { key: 'fmp',      name: 'FMP',     tier: 'freemium' },
  { key: 'fred',     name: 'FRED',    tier: 'free'     },
  { key: 'bls',      name: 'BLS',     tier: 'free'     },
  { key: 'eia',      name: 'EIA',     tier: 'free'     },
  { key: 'econdb',   name: 'EconDB',  tier: 'free'     },
  { key: 'intrinio', name: 'Intrinio',tier: 'paid'     },
]

// ==================== Tier Badge ====================

function TierBadge({ tier }: { tier: Tier }) {
  const { t } = useTranslation()
  const label = t(`marketDataPage.tier.${tier}`)
  const cls =
    tier === 'free'     ? 'bg-green/10 text-green border-green/20' :
    tier === 'freemium' ? 'bg-accent/10 text-accent border-accent/20' :
                          'bg-bg-tertiary text-text-muted border-border'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  )
}

// ==================== Test Button ====================

function TestButton({
  status,
  disabled,
  onClick,
}: {
  status: 'idle' | 'testing' | 'ok' | 'error'
  disabled: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const labels = {
    idle:    t('marketDataPage.apiKeys.test'),
    testing: t('marketDataPage.apiKeys.testing'),
    ok:      t('marketDataPage.apiKeys.ok'),
    error:   t('marketDataPage.apiKeys.fail'),
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 border rounded-md px-3 py-2 text-[13px] font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default ${
        status === 'ok'
          ? 'border-green text-green'
          : status === 'error'
            ? 'border-red text-red'
            : 'border-border text-text-muted hover:bg-bg-tertiary hover:text-text'
      }`}
    >
      {labels[status]}
    </button>
  )
}

// ==================== Page ====================

export function MarketDataPage() {
  const { t } = useTranslation()
  const { config, status, loadError, updateConfig, updateConfigImmediate, retry } = useConfigPage<MarketDataConfig>({
    section: 'marketData',
    extract: (full: AppConfig) => (full as Record<string, unknown>).marketData as MarketDataConfig,
  })

  const enabled = !config || (config as Record<string, unknown>).enabled !== false

  if (!config) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <PageHeader title={t('marketDataPage.title')} description={t('marketDataPage.description')} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-text-muted">{t('marketDataPage.loading')}</p>
        </div>
      </div>
    )
  }

  const dataBackend = (config.backend as string) || 'typebb-sdk'
  const apiUrl = (config.apiUrl as string) || 'http://localhost:6900'
  const providers = (config.providers ?? { equity: 'yfinance', crypto: 'yfinance', currency: 'yfinance', commodity: 'yfinance' }) as Record<string, string>
  const providerKeys = (config.providerKeys ?? {}) as Record<string, string>

  const handleProviderChange = (asset: string, provider: string) => {
    updateConfigImmediate({ providers: { ...providers, [asset]: provider } })
  }

  const handleKeyChange = (keyName: string, value: string) => {
    const all = (config.providerKeys ?? {}) as Record<string, string>
    const updated = { ...all, [keyName]: value }
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(updated)) {
      if (v) cleaned[k] = v
    }
    updateConfig({ providerKeys: cleaned })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={t('marketDataPage.title')}
        description={t('marketDataPage.description')}
        right={
          <div className="flex items-center gap-3">
            <SaveIndicator status={status} onRetry={retry} />
            <Toggle size="sm" checked={enabled} onChange={(v) => updateConfigImmediate({ enabled: v })} />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        <div className={`max-w-[880px] mx-auto ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <AssetProvidersSection
            providers={providers}
            onProviderChange={handleProviderChange}
          />
          <ApiKeysSection
            providerKeys={providerKeys}
            onKeyChange={handleKeyChange}
          />
          <AdvancedSection
            backend={dataBackend}
            apiUrl={apiUrl}
            onBackendChange={(backend) => updateConfigImmediate({ backend })}
            onApiUrlChange={(url) => updateConfig({ apiUrl: url })}
          />
        </div>
        {loadError && (
          <p className="text-[13px] text-red mt-4 max-w-[880px] mx-auto">
            {t('marketDataPage.loadFailed')}
          </p>
        )}
      </div>
    </div>
  )
}

// ==================== Asset Providers Section ====================

function AssetProvidersSection({
  providers,
  onProviderChange,
}: {
  providers: Record<string, string>
  onProviderChange: (asset: string, provider: string) => void
}) {
  const { t } = useTranslation()
  return (
    <ConfigSection
      title={t('marketDataPage.assetProviders.title')}
      description={t('marketDataPage.assetProviders.description')}
    >
      <div className="space-y-3">
        {ASSET_KEYS.map((asset) => {
          const options = PROVIDER_OPTIONS[asset]
          const selectedProvider = providers[asset] || options[0]
          return (
            <div key={asset} className="flex items-center gap-3">
              <span className="text-[13px] text-text w-24 shrink-0 font-medium capitalize">{asset}</span>
              <select
                className={`${inputClass} max-w-[180px]`}
                value={selectedProvider}
                onChange={(e) => onProviderChange(asset, e.target.value)}
              >
                {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {selectedProvider === 'yfinance' && (
                <span className="text-[13px] text-text-muted/50 px-1">
                  {t('marketDataPage.assetProviders.free')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </ConfigSection>
  )
}

// ==================== API Keys Section ====================

function ApiKeysSection({
  providerKeys,
  onKeyChange,
}: {
  providerKeys: Record<string, string>
  onKeyChange: (keyName: string, value: string) => void
}) {
  const { t } = useTranslation()
  const [localKeys, setLocalKeys] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of ALL_PROVIDERS) init[p.key] = providerKeys[p.key] || ''
    return init
  })
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({})
  const [testErrors, setTestErrors] = useState<Record<string, string>>({})

  const handleKeyChange = (keyName: string, value: string) => {
    setLocalKeys((prev) => ({ ...prev, [keyName]: value }))
    setTestStatus((prev) => ({ ...prev, [keyName]: 'idle' }))
    setTestErrors((prev) => ({ ...prev, [keyName]: '' }))
    onKeyChange(keyName, value)
  }

  const testProvider = async (keyName: string) => {
    const key = localKeys[keyName]
    if (!key) return
    setTestStatus((prev) => ({ ...prev, [keyName]: 'testing' }))
    setTestErrors((prev) => ({ ...prev, [keyName]: '' }))
    try {
      const result = await api.marketData.testProvider(keyName, key)
      setTestStatus((prev) => ({ ...prev, [keyName]: result.ok ? 'ok' : 'error' }))
      if (!result.ok && result.error) {
        setTestErrors((prev) => ({ ...prev, [keyName]: result.error! }))
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [keyName]: 'error' }))
      setTestErrors((prev) => ({ ...prev, [keyName]: err instanceof Error ? err.message : String(err) }))
    }
  }

  return (
    <ConfigSection
      title={t('marketDataPage.apiKeys.title')}
      description={t('marketDataPage.apiKeys.description')}
    >
      <div className="space-y-5">
        {ALL_PROVIDERS.map(({ key, name, tier }) => {
          const status = testStatus[key] || 'idle'
          const errMsg = testErrors[key] || ''
          const desc = t(`marketDataPage.providers.${key}.desc`)
          const hint = t(`marketDataPage.providers.${key}.hint`)
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-medium text-text">{name}</span>
                <TierBadge tier={tier} />
              </div>
              <p className="text-[12px] text-text-muted/70 mb-1">{desc}</p>
              <p className="text-[11px] text-text-muted/50 mb-2">{hint}</p>
              <div className="flex items-center gap-2">
                <input
                  className={inputClass}
                  type="password"
                  value={localKeys[key]}
                  onChange={(e) => handleKeyChange(key, e.target.value)}
                  placeholder={t('marketDataPage.apiKeys.placeholder')}
                />
                <TestButton
                  status={status}
                  disabled={!localKeys[key] || status === 'testing'}
                  onClick={() => testProvider(key)}
                />
              </div>
              {status === 'error' && errMsg && (
                <p className="mt-1.5 text-[11px] text-red/80 leading-snug">{errMsg}</p>
              )}
            </div>
          )
        })}
      </div>
    </ConfigSection>
  )
}

// ==================== Advanced Section ====================

function AdvancedSection({
  backend,
  apiUrl,
  onBackendChange,
  onApiUrlChange,
}: {
  backend: string
  apiUrl: string
  onBackendChange: (backend: string) => void
  onApiUrlChange: (url: string) => void
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="py-6 border-b border-border/60 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 cursor-pointer text-left mb-1"
      >
        <h3 className="text-[14px] font-semibold text-text">{t('marketDataPage.advanced.title')}</h3>
        <span className="text-[11px] text-text-muted/50">{expanded ? '▾' : '▸'}</span>
      </button>
      {!expanded && (
        <p className="text-[13px] text-text-muted/70">{t('marketDataPage.advanced.description')}</p>
      )}
      {expanded && (
        <div className="space-y-6 mt-4">
          <div>
            <p className="text-[13px] font-medium text-text mb-2">{t('marketDataPage.advanced.backendLabel')}</p>
            <div className="flex border border-border rounded-lg overflow-hidden w-fit mb-2">
              {(['typebb-sdk', 'openbb-api'] as const).map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => onBackendChange(opt)}
                  className={`px-4 py-1.5 text-[13px] font-medium transition-colors cursor-pointer ${
                    i > 0 ? 'border-l border-border' : ''
                  } ${
                    backend === opt
                      ? 'bg-bg-tertiary text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {opt === 'typebb-sdk'
                    ? t('marketDataPage.advanced.builtIn')
                    : t('marketDataPage.advanced.external')}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-text-muted/70">
              {backend === 'typebb-sdk'
                ? t('marketDataPage.advanced.builtInDesc')
                : t('marketDataPage.advanced.externalDesc')}
            </p>
            {backend === 'openbb-api' && (
              <div className="mt-3">
                <Field label={t('marketDataPage.advanced.apiUrl')}>
                  <input
                    className={inputClass}
                    value={apiUrl}
                    onChange={(e) => onApiUrlChange(e.target.value)}
                    placeholder="http://localhost:6900"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
