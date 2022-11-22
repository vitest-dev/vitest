import { client, config, findById } from './client'
import { activeFileId } from './params'
import type { File } from '#types'

export const currentModule = ref<File>()
export const dashboardVisible = ref(true)
export const coverageVisible = ref(false)
export const coverage = computed(() => config.value?.coverage)
export const coverageEnabled = computed(() => {
  if (!config.value?.api?.port)
    return false

  const cov = coverage.value
  return cov && cov.enabled && cov.reporter.includes('html')
})
export const coverageUrl = computed(() => {
  if (coverageEnabled.value) {
    const url = `${window.location.protocol}//${window.location.hostname}:${config.value!.api!.port!}`
    const idx = coverage.value!.reportsDirectory.lastIndexOf('/')
    return `${url}/${coverage.value!.reportsDirectory.slice(idx + 1)}/index.html`
  }
  //
  return undefined
})

export function initializeNavigation() {
  const file = activeFileId.value
  if (file && file.length > 0) {
    const current = findById(file)
    if (current) {
      currentModule.value = current
      dashboardVisible.value = false
      coverageVisible.value = false
    }
    else {
      watchOnce(
        () => client.state.getFiles(),
        () => {
          currentModule.value = findById(file)
          dashboardVisible.value = false
          coverageVisible.value = false
        },
      )
    }
  }

  return dashboardVisible
}

export function showDashboard(show: boolean) {
  dashboardVisible.value = show
  coverageVisible.value = false
  if (show) {
    currentModule.value = undefined
    activeFileId.value = ''
  }
}

export function showCoverage() {
  coverageVisible.value = true
  dashboardVisible.value = false
  currentModule.value = undefined
  activeFileId.value = ''
}
