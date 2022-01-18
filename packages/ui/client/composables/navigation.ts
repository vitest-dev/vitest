import { client, findById } from './client'
import { activeFileId } from './params'
import type { File } from '#types'

export const currentModule = ref<File | undefined>(undefined)
export const dashboardVisible = ref(true)

export function initializeNavigation() {
  const file = activeFileId.value
  if (file && file.length > 0) {
    const current = findById(file)
    if (current) {
      currentModule.value = current
      dashboardVisible.value = false
    }
    else {
      watchOnce(
        () => client.state.getFiles(),
        () => {
          currentModule.value = findById(file)
          dashboardVisible.value = false
        },
      )
    }
  }

  return dashboardVisible
}

export function showDashboard(show: boolean) {
  dashboardVisible.value = show
  if (show) {
    currentModule.value = undefined
    activeFileId.value = ''
  }
}
