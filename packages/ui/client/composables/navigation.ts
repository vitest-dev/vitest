import type { File, Task } from '@vitest/runner'
import type { Params } from './params'
import { useLocalStorage, watchOnce } from '@vueuse/core'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { viewport } from './browser'
import { client, config, findById } from './client'
import { testRunState } from './client/state'
import { showTaskSource } from './codemirror'
import { activeFileId, columnNumber, lineNumber, selectedTest, viewMode } from './params'

export const currentModule = ref<File>()
export const dashboardVisible = ref(true)
export const coverageVisible = ref(false)
export const disableCoverage = ref(true)
export const coverage = computed(() => config.value?.coverage)
export const coverageConfigured = computed(() => coverage.value?.enabled)
export const coverageEnabled = computed(() => {
  return (
    coverageConfigured.value
    && !!coverage.value?.htmlDir
  )
})
export const mainSizes = useLocalStorage<[left: number, right: number]>(
  'vitest-ui_splitpanes-mainSizes',
  [33, 67],
)
export const detailSizes = useLocalStorage<[left: number, right: number]>(
  'vitest-ui_splitpanes-detailSizes',
  [
    // @ts-expect-error "browserState" is not initialised yet
    window.__vitest_browser_runner__?.provider === 'webdriverio'
      ? ((viewport.value[0] / window.outerWidth) * 100)
      : 33,
    67,
  ],
)

export const detailsPanelVisible = useLocalStorage<boolean>(
  'vitest-ui_details-panel-visible',
  true,
)

export const detailsPosition = ref<'right' | 'bottom'>('right')

nextTick(() => {
  watch(config, () => {
    if (config.value?.browser?.detailsPanelPosition) {
      detailsPosition.value = config.value.browser.detailsPanelPosition
    }
  })
})

export function hideDetailsPanel() {
  // setTimeout is used to avoid splitpanes throwing a race condition error
  setTimeout(() => {
    detailsPanelVisible.value = false
  }, 0)
}
export function showDetailsPanel() {
  detailsPanelVisible.value = true
}

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

export function navigateTo({ file, line, view, test, column }: Params) {
  activeFileId.value = file
  lineNumber.value = line
  columnNumber.value = column
  viewMode.value = view
  selectedTest.value = test
  currentModule.value = findById(file)
  showDashboard(false)
}

export function clickOnTask(task: Task) {
  if (task.type === 'test') {
    if (viewMode.value === 'editor') {
      showTaskSource(task)
    }
    else {
      navigateTo({
        file: task.file.id,
        line: null,
        column: null,
        view: viewMode.value,
        test: task.id,
      })
    }
  }
  else {
    navigateTo({
      file: task.file.id,
      test: null,
      line: null,
      view: viewMode.value,
      column: null,
    })
  }
}

export function showCoverage() {
  coverageVisible.value = true
  dashboardVisible.value = false
  currentModule.value = undefined
  activeFileId.value = ''
}

export function showNavigationPanel() {
  panels.navigation = 33
  panels.details.size = 67
  mainSizes.value = [33, 67]
}

export function toggleDetailsPosition() {
  detailsPosition.value = detailsPosition.value === 'right' ? 'bottom' : 'right'
  // Reset to default sizes when changing orientation
  const defaultSize = detailsPosition.value === 'bottom' ? 33 : 50
  detailSizes.value = [defaultSize, 100 - defaultSize]
  panels.details.browser = defaultSize
  panels.details.main = 100 - defaultSize
}
