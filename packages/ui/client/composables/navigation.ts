import type { File } from 'vitest'
import { client, config, findById, testRunState } from './client'
import { activeFileId } from './params'

export const currentModule = ref<File>()
export const dashboardVisible = ref(true)
export const coverageVisible = ref(false)
export const disableCoverage = ref(true)
export const coverage = computed(() => config.value?.coverage)
export const coverageConfigured = computed(() => {
  if (!config.value?.api?.port)
    return false

  return coverage.value?.enabled
})
export const coverageEnabled = computed(() => {
  return coverageConfigured.value
    && coverage.value.reporter.map(([reporterName]) => reporterName).includes('html')
})
export const coverageUrl = computed(() => {
  if (coverageEnabled.value) {
    const url = `${window.location.protocol}//${window.location.hostname}:${config.value!.api!.port!}`
    const idx = coverage.value!.reportsDirectory.lastIndexOf('/')
    const htmlReporter = coverage.value!.reporter.find((reporter) => {
      if (reporter[0] !== 'html')
        return undefined

      return reporter
    })
    return htmlReporter && 'subdir' in htmlReporter[1]
      ? `${url}/${coverage.value!.reportsDirectory.slice(idx + 1)}/${htmlReporter[1].subdir}/index.html`
      : `${url}/${coverage.value!.reportsDirectory.slice(idx + 1)}/index.html`
  }

  return undefined
})
watch(testRunState, (state) => {
  disableCoverage.value = state === 'running'
}, { immediate: true })
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
