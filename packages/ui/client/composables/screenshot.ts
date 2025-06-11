import type { RunnerTask } from 'vitest'

export function openScreenshot(task: RunnerTask) {
  const filePath = task.meta?.failScreenshotPath
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

export function useScreenshot() {
  const showScreenshot = ref(false)
  const timestamp = ref(Date.now())
  const currentTask = ref<RunnerTask | undefined>()
  const currentScreenshotUrl = computed(() => {
    const id = currentTask.value?.id
    // force refresh
    const t = timestamp.value
    // browser plugin using /, change this if base can be modified
    return id ? `/__screenshot-error?id=${encodeURIComponent(id)}&t=${t}` : undefined
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
