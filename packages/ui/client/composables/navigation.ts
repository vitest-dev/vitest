import type { File, Task } from '@vitest/runner'
import type { Params } from './params'
import { client, config, findById } from './client'
import { testRunState } from './client/state'
import { activeFileId, lineNumber, selectedTest, viewMode } from './params'

export const currentModule = ref<File>()
export const dashboardVisible = ref(true)
export const coverageVisible = ref(false)
export const disableCoverage = ref(true)
export const coverage = computed(() => config.value?.coverage)
export const coverageConfigured = computed(() => coverage.value?.enabled)
export const coverageEnabled = computed(() => {
  return (
    coverageConfigured.value
    && !!coverage.value.htmlReporter
  )
})
export const mainSizes = useLocalStorage<[left: number, right: number]>(
  'vitest-ui_splitpanes-mainSizes',
  [33, 67],
  {
    initOnMounted: true,
  },
)
export const detailSizes = useLocalStorage<[left: number, right: number]>(
  'vitest-ui_splitpanes-detailSizes',
  [33, 67],
  {
    initOnMounted: true,
  },
)

// live sizes of panels in percentage
export const panels = reactive({
  navigation: mainSizes.value[0],
  details: {
    size: mainSizes.value[1],
    // these sizes are relative to the details panel
    browser: detailSizes.value[0],
    main: detailSizes.value[1],
  },
})

// TODO
// For html report preview, "coverage.reportsDirectory" must be explicitly set as a subdirectory of html report.
// Handling other cases seems difficult, so this limitation is mentioned in the documentation for now.
export const coverageUrl = computed(() => {
  if (coverageEnabled.value) {
    const idx = coverage.value!.reportsDirectory.lastIndexOf('/')
    const htmlReporterSubdir = coverage.value!.htmlReporter?.subdir
    return htmlReporterSubdir
      ? `/${coverage.value!.reportsDirectory.slice(idx + 1)}/${
        htmlReporterSubdir
      }/index.html`
      : `/${coverage.value!.reportsDirectory.slice(idx + 1)}/index.html`
  }

  return undefined
})

watch(
  testRunState,
  (state) => {
    disableCoverage.value = state === 'running'
  },
  { immediate: true },
)

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

export function navigateTo({ file, line, view, test }: Params) {
  activeFileId.value = file
  lineNumber.value = line
  viewMode.value = view
  selectedTest.value = test
  currentModule.value = findById(file)
  showDashboard(false)
}

export function showReport(task: Task) {
  navigateTo({
    file: task.file.id,
    test: task.type === 'test' ? task.id : null,
    line: null,
    view: null,
  })
}

export function showCoverage() {
  coverageVisible.value = true
  dashboardVisible.value = false
  currentModule.value = undefined
  activeFileId.value = ''
}

export function hideRightPanel() {
  panels.details.browser = 100
  panels.details.main = 0
  detailSizes.value = [100, 0]
}

export function showRightPanel() {
  panels.details.browser = 33
  panels.details.main = 67
  detailSizes.value = [33, 67]
}

export function showNavigationPanel() {
  panels.navigation = 33
  panels.details.size = 67
  mainSizes.value = [33, 67]
}
