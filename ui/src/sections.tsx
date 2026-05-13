/**
 * Section config — what the secondary sidebar shows for each ActivitySection.
 */

import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatChannelListContainer } from './components/ChatChannelListContainer'
import { NewChannelButton } from './components/NewChannelButton'
import { PushApprovalPanel } from './components/PushApprovalPanel'
import { SettingsCategoryList } from './components/SettingsCategoryList'
import { DevCategoryList } from './components/DevCategoryList'
import { MarketSidebar } from './components/MarketSidebar'
import { PortfolioSidebar } from './components/PortfolioSidebar'
import { AutomationSidebar } from './components/AutomationSidebar'
import { NewsSidebar } from './components/NewsSidebar'
import type { ActivitySection } from './tabs/types'

export interface SidebarSection {
  title: string
  Secondary: ComponentType
  Actions?: ComponentType
}

type SectionKey = ActivitySection

interface RawSection {
  titleKey: string
  Secondary: ComponentType
  Actions?: ComponentType
}

const RAW_SECTIONS: Record<SectionKey, RawSection> = {
  chat:            { titleKey: 'sidebar.chat',          Secondary: ChatChannelListContainer, Actions: NewChannelButton },
  'trading-as-git':{ titleKey: 'sidebar.tradingAsGit',  Secondary: PushApprovalPanel },
  settings:        { titleKey: 'sidebar.settings',      Secondary: SettingsCategoryList },
  dev:             { titleKey: 'sidebar.dev',            Secondary: DevCategoryList },
  market:          { titleKey: 'sidebar.market',        Secondary: MarketSidebar },
  portfolio:       { titleKey: 'sidebar.portfolio',     Secondary: PortfolioSidebar },
  automation:      { titleKey: 'sidebar.automation',    Secondary: AutomationSidebar },
  news:            { titleKey: 'sidebar.news',          Secondary: NewsSidebar },
}

export function findSectionForActivity(
  section: ActivitySection | null | undefined,
): SidebarSection | null {
  if (!section) return null
  const raw = RAW_SECTIONS[section]
  if (!raw) return null
  // Return a placeholder; actual title resolved in useSidebarSection below.
  return { title: raw.titleKey, Secondary: raw.Secondary, Actions: raw.Actions }
}

/** Returns the translated SidebarSection for the given activity. */
export function useSidebarSection(section: ActivitySection | null | undefined): SidebarSection | null {
  const { t } = useTranslation()
  if (!section) return null
  const raw = RAW_SECTIONS[section]
  if (!raw) return null
  return { title: t(raw.titleKey), Secondary: raw.Secondary, Actions: raw.Actions }
}
