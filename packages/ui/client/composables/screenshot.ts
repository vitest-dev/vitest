import type { RunnerTask } from 'vitest'
import { computed, ref } from 'vue'

export function hasScreenshot(task: RunnerTask): boolean {
  const hasArray = task.meta?.screenshotPaths && Array.isArray(task.meta.screenshotPaths) && task.meta.screenshotPaths.length > 0
  const hasSingle = !!task.meta?.failScreenshotPath
  return hasArray || hasSingle
}

export function getScreenshotUrls(task: RunnerTask): string[] {
  const pathSet = new Set<string>()

  // Add screenshots from array (manual + auto)
  if (task.meta?.screenshotPaths && Array.isArray(task.meta.screenshotPaths)) {
    task.meta.screenshotPaths.forEach((path) => {
      if (path) {
        pathSet.add(path)
      }
    })
  }

  // Add failure screenshot if present (deduplicate with Set)
  if (task.meta?.failScreenshotPath) {
    pathSet.add(task.meta.failScreenshotPath)
  }

  // Sort paths: auto screenshots first, then manual screenshots by number
  const sortedPaths = Array.from(pathSet).sort((a, b) => {
    const aIsAuto = a.includes('-auto-') || a.includes('-auto.')
    const bIsAuto = b.includes('-auto-') || b.includes('-auto.')

    // Auto screenshots come first
    if (aIsAuto && !bIsAuto) {
      return -1
    }
    if (!aIsAuto && bIsAuto) {
      return 1
    }

    // Both auto or both manual: sort alphabetically (which sorts numbers correctly)
    return a.localeCompare(b)
  })

  // Convert unique paths to URLs
  return sortedPaths.map(path =>
    `/__vitest_attachment__?path=${encodeURIComponent(path)}&contentType=image/png&token=${(window as any).VITEST_API_TOKEN}`,
  )
}

export function openScreenshot(task: RunnerTask) {
  const filePath = task.meta?.failScreenshotPath
    || (task.meta?.screenshotPaths && task.meta.screenshotPaths[0])
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

export function useScreenshot() {
  const showScreenshot = ref(false)
  const timestamp = ref(Date.now())
  const currentTask = ref<RunnerTask | undefined>()
  const currentScreenshotUrl = computed(() => {
    const task = currentTask.value
    if (!task) {
      return undefined
    }
    const screenshotPath = task.meta?.failScreenshotPath
      || (task.meta?.screenshotPaths && task.meta.screenshotPaths[0])
    if (!screenshotPath) {
      return undefined
    }
    // force refresh with timestamp
    const t = timestamp.value
    return `/__vitest_attachment__?path=${encodeURIComponent(screenshotPath)}&contentType=image/png&token=${(window as any).VITEST_API_TOKEN}&t=${t}`
  })

  function showScreenshotModal(task: RunnerTask) {
    currentTask.value = task
    timestamp.value = Date.now()
    showScreenshot.value = true
  }

  return {
    currentTask,
    showScreenshot,
    currentScreenshotUrl,
    showScreenshotModal,
  }
}
