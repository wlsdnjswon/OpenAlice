import { useTranslation } from 'react-i18next'
import { useWorkspace } from '../tabs/store'
import { getFocusedTab, type ViewSpec } from '../tabs/types'
import { SidebarRow } from './SidebarRow'

type SettingsCategory = Extract<ViewSpec, { kind: 'settings' }>['params']['category']

interface CategoryItem {
  labelKey: string
  category: SettingsCategory
  alsoActiveFor?: ViewSpec['kind'][]
}

const CATEGORIES: CategoryItem[] = [
  { labelKey: 'settingsCategories.general',        category: 'general' },
  { labelKey: 'settingsCategories.aiProvider',     category: 'ai-provider' },
  { labelKey: 'settingsCategories.tradingAccounts',category: 'trading', alsoActiveFor: ['uta-detail'] },
  { labelKey: 'settingsCategories.connectors',     category: 'connectors' },
  { labelKey: 'settingsCategories.marketData',     category: 'market-data' },
  { labelKey: 'settingsCategories.newsSources',    category: 'news-collector' },
]

export function SettingsCategoryList() {
  const { t } = useTranslation()
  const focused = useWorkspace((state) => getFocusedTab(state)?.spec)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  return (
    <div className="py-0.5">
      {CATEGORIES.map((item) => {
        const active =
          (focused?.kind === 'settings' && focused.params.category === item.category) ||
          (item.alsoActiveFor != null && focused != null && item.alsoActiveFor.includes(focused.kind))
        return (
          <SidebarRow
            key={item.category}
            label={t(item.labelKey)}
            active={active}
            onClick={() => openOrFocus({ kind: 'settings', params: { category: item.category } })}
          />
        )
      })}
    </div>
  )
}
