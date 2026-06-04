import type { InjectionKey, Ref } from 'vue'

export interface SmallTabsConfig {
  id: string
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
  tab: (id: SmallTabsConfig['id'], globalContext: SmallTabsContext['id']) =>
    `${globalContext}-${id}-tab`,
  tabpanel: (id: SmallTabsConfig['id'], globalContext: SmallTabsContext['id']) =>
    `${globalContext}-${id}-tabpanel`,
}
