import type { InjectionKey, Ref } from 'vue'

export interface SmallTabsConfig {
  name: string
  title: string
}

export interface SmallTabsContext {
  id: string
  activeTab: Ref<string | null>
  registerTab: (tab: SmallTabsConfig) => void
  unregisterTab: (tab: SmallTabsConfig) => void
}

export const SMALL_TABS_CONTEXT: InjectionKey<SmallTabsContext> = Symbol('tabContext')

export const idFor = {
  tab: (name: string, id: string) => `${id}-${name}-tab`,
  tabpanel: (name: string, id: string) => `${id}-${name}-tabpanel`,
}
