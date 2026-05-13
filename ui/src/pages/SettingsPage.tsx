import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type AppConfig } from '../api'
import type { ToolInfo } from '../api/tools'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading, EmptyState } from '../components/StateViews'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

// ==================== Settings Section ====================

function SettingsSection() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    api.config.load().then(setConfig).catch(() => {})
  }, [])

  if (!config) return <PageLoading />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[880px] mx-auto">
        {/* Display / Language */}
        <ConfigSection
          title={t('settings.sections.display.title')}
          description={t('settings.sections.display.description')}
        >
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex-1">
              <span className="text-sm font-medium text-text">{t('settings.language')}</span>
              <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                {t('settings.languageDescription')}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </ConfigSection>

        {/* Agent */}
        <ConfigSection
          title={t('settings.sections.agent.title')}
          description={t('settings.sections.agent.description')}
        >
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex-1">
              <span className="text-sm font-medium text-text">
                {t('settings.evolutionMode')}
              </span>
              <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                {config.agent?.evolutionMode
                  ? t('settings.evolutionModeOn')
                  : t('settings.evolutionModeOff')}
              </p>
            </div>
            <Toggle
              checked={config.agent?.evolutionMode || false}
              onChange={async (v) => {
                try {
                  await api.config.updateSection('agent', { ...config.agent, evolutionMode: v })
                  setConfig((c) => c ? { ...c, agent: { ...c.agent, evolutionMode: v } } : c)
                } catch {
                  // Toggle doesn't flip on failure
                }
              }}
            />
          </div>
        </ConfigSection>

        {/* Persona */}
        <ConfigSection
          title={t('settings.sections.persona.title')}
          description={t('settings.sections.persona.description')}
        >
          <PersonaEditor />
        </ConfigSection>

        {/* Compaction */}
        <ConfigSection
          title={t('settings.sections.compaction.title')}
          description={t('settings.sections.compaction.description')}
        >
          <CompactionForm config={config} />
        </ConfigSection>
      </div>
    </div>
  )
}

// ==================== Compaction Form ====================

function CompactionForm({ config }: { config: AppConfig }) {
  const { t } = useTranslation()
  const [ctx, setCtx] = useState(String(config.compaction?.maxContextTokens || ''))
  const [out, setOut] = useState(String(config.compaction?.maxOutputTokens || ''))

  const data = useMemo(
    () => ({ maxContextTokens: Number(ctx), maxOutputTokens: Number(out) }),
    [ctx, out],
  )

  const save = useCallback(async (d: { maxContextTokens: number; maxOutputTokens: number }) => {
    await api.config.updateSection('compaction', d)
  }, [])

  const { status, retry } = useAutoSave({ data, save })

  return (
    <>
      <Field label={t('settings.maxContextTokens')}>
        <input className={inputClass} type="number" step={1000} value={ctx} onChange={(e) => setCtx(e.target.value)} />
      </Field>
      <Field label={t('settings.maxOutputTokens')}>
        <input className={inputClass} type="number" step={1000} value={out} onChange={(e) => setOut(e.target.value)} />
      </Field>
      <SaveIndicator status={status} onRetry={retry} />
    </>
  )
}

// ==================== Persona Editor ====================

function PersonaEditor() {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    api.persona.get()
      .then(({ content, path }) => {
        setContent(content)
        setFilePath(path)
      })
      .catch(() => setError(t('errors.failedToLoad')))
      .finally(() => setLoading(false))
  }, [t])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api.persona.update(content)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t('errors.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-muted">{t('common.loading')}</div>

  return (
    <>
      <textarea
        className={`${inputClass} min-h-[200px] max-h-[400px] resize-y font-mono text-xs leading-relaxed`}
        value={content}
        onChange={(e) => { setContent(e.target.value); setDirty(true) }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary-sm"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            <span className="text-text-muted">{t('common.saved')}</span>
          </span>
        )}
        {error && (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            <span className="text-red">{error}</span>
          </span>
        )}
        {dirty && !saved && !error && (
          <span className="text-[11px] text-text-muted">{t('common.unsavedChanges')}</span>
        )}
      </div>
      {filePath && <p className="text-[11px] text-text-muted mt-1">{filePath}</p>}
    </>
  )
}

// ==================== Tools Section ====================

function ToolsSection() {
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<ToolInfo[]>([])
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.tools.load().then((res) => {
      setInventory(res.inventory)
      setDisabled(new Set(res.disabled))
      setLoaded(true)
    }).catch(() => {})
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, ToolInfo[]>()
    for (const tool of inventory) {
      if (!map.has(tool.group)) map.set(tool.group, [])
      map.get(tool.group)!.push(tool)
    }
    return Array.from(map.entries()).map(([key, tools]) => ({
      key,
      label: t(`settings.toolGroups.${key}`, { defaultValue: key }),
      tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [inventory, t])

  const configData = useMemo(
    () => ({ disabled: [...disabled].sort() }),
    [disabled],
  )

  const save = useCallback(async (d: { disabled: string[] }) => {
    await api.tools.update(d.disabled)
  }, [])

  const { status, retry } = useAutoSave({ data: configData, save, enabled: loaded })

  const toggleTool = useCallback((name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleGroup = useCallback((tools: ToolInfo[], enable: boolean) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      for (const tool of tools) {
        if (enable) next.delete(tool.name)
        else next.add(tool.name)
      }
      return next
    })
  }, [])

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      {!loaded ? (
        <PageLoading />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('settings.tools.empty')}
          description={t('settings.tools.emptyHint')}
        />
      ) : (
        <div className="max-w-[880px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-text-muted">
              {t('settings.tools.summary', { count: inventory.length, groups: groups.length })}
            </p>
            <SaveIndicator status={status} onRetry={retry} />
          </div>
          <div className="space-y-2">
            {groups.map((g) => (
              <ToolGroupCard
                key={g.key}
                group={g}
                disabled={disabled}
                expanded={expanded.has(g.key)}
                onToggleExpanded={() => toggleExpanded(g.key)}
                onToggleTool={toggleTool}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== ToolGroupCard ====================

interface ToolGroupCardProps {
  group: { key: string; label: string; tools: ToolInfo[] }
  disabled: Set<string>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleTool: (name: string) => void
  onToggleGroup: (tools: ToolInfo[], enable: boolean) => void
}

function ToolGroupCard({
  group, disabled, expanded, onToggleExpanded, onToggleTool, onToggleGroup,
}: ToolGroupCardProps) {
  const enabledCount = group.tools.filter((t) => !disabled.has(t.name)).length
  const noneEnabled = enabledCount === 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-medium text-text truncate">{group.label}</span>
          <span className="text-[11px] text-text-muted shrink-0">
            {enabledCount}/{group.tools.length}
          </span>
        </button>
        <Toggle
          size="sm"
          checked={!noneEnabled}
          onChange={(v) => onToggleGroup(group.tools, v)}
        />
      </div>
      <div
        className={`transition-all duration-150 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="divide-y divide-border">
          {group.tools.map((tool) => {
            const enabled = !disabled.has(tool.name)
            return (
              <div
                key={tool.name}
                className={`flex items-center gap-3 px-4 py-2 ${enabled ? '' : 'opacity-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-text font-mono">{tool.name}</span>
                  {tool.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                      {tool.description}
                    </p>
                  )}
                </div>
                <Toggle size="sm" checked={enabled} onChange={() => onToggleTool(tool.name)} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== Page ====================

type Tab = 'settings' | 'tools'

export function SettingsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('settings')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'settings', label: t('settings.tabs.settings') },
    { key: 'tools',    label: t('settings.tabs.tools') },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={t('settings.title')} />

      <div className="px-4 md:px-6 border-b border-border/60">
        <div className="flex gap-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                tab === tabItem.key ? 'text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              {tabItem.label}
              {tab === tabItem.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-8 py-6">
        <div className="flex-1 min-h-0">
          {tab === 'settings' ? <SettingsSection /> : <ToolsSection />}
        </div>
      </div>
    </div>
  )
}
