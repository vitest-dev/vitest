import { useDark, useToggle } from '@vueuse/core'

const theme: 'dark' | 'light' | 'auto' = (window as any).VITEST_UI_THEME || 'auto'

export const isDark = useDark({
  initialValue: theme,
  // the configured theme applies on every page load, so the toggled theme is not stored
  storageKey: theme === 'auto' ? undefined : null,
})
export const toggleDark = useToggle(isDark)
